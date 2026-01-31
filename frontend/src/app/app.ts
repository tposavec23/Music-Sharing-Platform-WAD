import { Component, OnInit } from '@angular/core';

import { Router, RouterModule, RouterLink, RouterLinkActive } from '@angular/router';

import { CommonModule } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';



import { User } from './models/user';

import { AuthService } from './services/auth';

import { LoginDialog } from './dialogs/login/login';



@Component({

  selector: 'app-root',

  standalone: true,


  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],

  templateUrl: './app.html',

  styleUrls: ['./app.scss']

})

export class App implements OnInit {

  user: User | null = null;



  constructor(

    private router: Router,

    private authService: AuthService,

    private dialog: MatDialog

  ) {

    this.authService.currentUser$.subscribe(u => (this.user = u));

  }



  ngOnInit() {

    this.authService.whoami().subscribe();

  }



  onLogin() {

    const dialogRef = this.dialog.open(LoginDialog, {

      width: '400px',

      panelClass: 'custom-dialog-container'
    });



    dialogRef.afterClosed().subscribe(result => {

      if (result === 'success') this.router.navigate(['/']);

    });

  }



  onLogout() {

    this.authService.logout().subscribe();

    this.router.navigate(['/']);

  }

}