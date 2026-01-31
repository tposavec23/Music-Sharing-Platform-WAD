import { Router, Request, Response, NextFunction } from 'express';
import { sysdb } from '../helpers/sysdb';
import { db } from '../helpers/db';
import { HttpError } from '../helpers/errors';
import { requireRole } from '../helpers/auth';
import { RoleType } from '../model/user';
import PDFDocument from 'pdfkit';

export const auditLogRouter = Router();

async function getUsername(userId: number | null): Promise<string | null> {
  if (userId === null) return null;
  const user = await sysdb.connection!.get('SELECT username FROM users WHERE user_id = ?', userId);
  return user?.username || null;
}


auditLogRouter.get('/', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 100);
    const offset = (page - 1) * limit;
    const action = req.query.action as string;
    const userId = req.query.user_id ? parseInt(req.query.user_id as string) : undefined;

    // Build query with optional filters
    let whereClause = '';
    const params: any[] = [];

    if (action) {
      whereClause += ' WHERE a.action = ?';
      params.push(action);
    }

    if (userId !== undefined) {
      whereClause += whereClause ? ' AND a.user_id = ?' : ' WHERE a.user_id = ?';
      params.push(userId);
    }

    const countResult = await db.connection!.get(
      `SELECT COUNT(*) as total FROM audit_log a${whereClause}`,
      ...params
    );

    const logsRaw = await db.connection!.all(`
      SELECT
        a.id,
        a.action,
        a.target_id,
        a.timestamp,
        a.user_id
      FROM audit_log a
      ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `, ...params, limit, offset);

    const logs = await Promise.all(logsRaw.map(async (log: any) => ({
      ...log,
      username: await getUsername(log.user_id)
    })));

    res.json({
      logs: logs,
      pagination: {
        page: page,
        limit: limit,
        total: countResult?.total || 0,
        total_pages: Math.ceil((countResult?.total || 0) / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});


auditLogRouter.get('/actions', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actions = await db.connection!.all(`
      SELECT DISTINCT action, COUNT(*) as count
      FROM audit_log
      GROUP BY action
      ORDER BY count DESC
    `);

    res.json(actions);
  } catch (error) {
    next(error);
  }
});


auditLogRouter.get('/export/pdf', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    
    const logsRaw = await db.connection!.all(`
      SELECT a.id, a.action, a.target_id, a.timestamp, a.user_id
      FROM audit_log a
      ORDER BY a.timestamp DESC
      LIMIT 500
    `);

    const logs = await Promise.all(logsRaw.map(async (log: any) => ({
      ...log,
      username: await getUsername(log.user_id)
    })));

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.pdf`);

    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('Audit Log Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    const col = { id: 40, action: 100, user: 250, target: 340, time: 400 };
    const rowHeight = 18;

    const drawHeader = () => {
      const y = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('ID', col.id, y);
      doc.text('Action', col.action, y);
      doc.text('User', col.user, y);
      doc.text('Target', col.target, y);
      doc.text('Timestamp', col.time, y);
      doc.moveTo(40, y + 12).lineTo(555, y + 12).stroke();
      doc.y = y + rowHeight;
    };

    drawHeader();

    doc.font('Helvetica').fontSize(8);
    for (const log of logs) {
      if (doc.y > 780) {
        doc.addPage();
        doc.y = 40;
        drawHeader();
        doc.font('Helvetica').fontSize(8);
      }
      const y = doc.y;
      doc.text(String(log.id), col.id, y, { width: 55 });
      doc.text(log.action.substring(0, 25), col.action, y, { width: 145 });
      doc.text((log.username || 'System').substring(0, 15), col.user, y, { width: 85 });
      doc.text(String(log.target_id || '-'), col.target, y, { width: 55 });
      doc.text(new Date(log.timestamp).toLocaleString('hr-HR'), col.time, y, { width: 150 });
      doc.y = y + rowHeight;
    }

    doc.moveDown(2);
    doc.fontSize(9).text(`Total entries: ${logs.length}`, { align: 'center' });

    doc.end();
  } catch (error) {
    next(error);
  }
});

auditLogRouter.get('/:id', requireRole([RoleType.ADMINISTRATOR]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logId = parseInt(req.params.id);

    if (isNaN(logId)) {
      throw new HttpError(400, 'Invalid audit log ID');
    }

    const log = await db.connection!.get(`
      SELECT
        a.id,
        a.action,
        a.target_id,
        a.timestamp,
        a.user_id
      FROM audit_log a
      WHERE a.id = ?
    `, logId);

    if (!log) {
      throw new HttpError(404, 'Audit log entry not found');
    }

    res.json({
      ...log,
      username: await getUsername(log.user_id)
    });
  } catch (error) {
    next(error);
  }
});
