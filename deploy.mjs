import { config } from 'dotenv';
import { exec } from 'child_process';

config();
const deployTo = process.env.DEPLOYTO;
const command = `tar -cf - .env data.sqlite3 dist frontend/public frontend/dist/frontend/browser | ssh ${deployTo} "tar xvf -"`;

exec(command, (error, stdout, stderr) => {
  if(error) {
    console.error(error.message);
    return;
  }

  if(stderr) {
    console.error(stderr);
    return;
  }

  console.log(stdout);
});
