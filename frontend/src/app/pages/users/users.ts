import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/user';
import { UsersService } from '../../services/users';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.html',
  styleUrls: ['./users.scss']
})
export class UsersPage implements OnInit {
  users: User[] = [];
  
  openDropdownId: number | null = null;

  constructor(private usersService: UsersService) {}

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.usersService.getAll().subscribe({
      next: (u) => this.users = u,
      error: (err) => console.error(err)
    });
  }


  toggleDropdown(userId: number) {
    if (this.openDropdownId === userId) {
      this.openDropdownId = null; 
    } else {
      this.openDropdownId = userId; 
    }
  }

  closeDropdown() {
    this.openDropdownId = null;
  }

  setRole(user: User, newRole: number) {
    this.closeDropdown(); 

    if (!user.user_id || user.role_id === newRole) return;

    if (confirm(`Change role for ${user.username}?`)) {
      this.usersService.changeRole(user.user_id, newRole).subscribe({
        next: () => user.role_id = newRole,
        error: (err) => alert('Error: ' + err.message)
      });
    }
  }

  deleteUser(user: User) {
    if (!user.user_id) return;
    if (confirm(`Delete ${user.username}?`)) {
      this.usersService.delete(user.user_id).subscribe({
        next: () => this.users = this.users.filter(u => u.user_id !== user.user_id),
        error: (err) => alert('Error deleting user.')
      });
    }
  }
}