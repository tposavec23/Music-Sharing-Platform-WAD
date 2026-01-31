import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';



import { Genre } from '../../models/genre';

import { GenresService } from '../../services/genres';



@Component({

  selector: 'app-genres',

  standalone: true,

  imports: [CommonModule, FormsModule],

  templateUrl: './genres.html',

  styleUrls: ['./genres.scss']

})

export class GenresPage implements OnInit {

  genres: Genre[] = [];

 

  isCreateVisible = false;

  newGenreName = '';



  constructor(private genresService: GenresService) {}



  ngOnInit() {

    this.loadGenres();

  }



  loadGenres() {

    this.genresService.getAll().subscribe(g => this.genres = g);

  }



  toggleCreate() {

    this.isCreateVisible = !this.isCreateVisible;

  }



  submitCreate() {

    if (!this.newGenreName) return;



    this.genresService.create({ name: this.newGenreName }).subscribe({

      next: (newGenre) => {

        alert('Genre created!');

        this.genres.push(newGenre);

        this.newGenreName = '';

        this.isCreateVisible = false;

      },

      error: (err) => alert('Error: ' + (err.error?.message || err.message))

    });

  }



  editGenre(genre: Genre) {

    const newName = prompt('Enter new genre name:', genre.name);

   

    if (newName && newName !== genre.name) {

      this.genresService.update(genre.genre_id, { name: newName }).subscribe({

        next: () => {

          genre.name = newName;

        },

        error: (err) => alert('Error: ' + (err.error?.message || err.message))

      });

    }

  }



  deleteGenre(id: number) {

    if (confirm('Delete this genre?')) {

      this.genresService.delete(id).subscribe({

        next: () => {

          this.genres = this.genres.filter(g => g.genre_id !== id);

          alert('Genre deleted.');

        },

        error: (err) => alert('Error: ' + (err.error?.message || err.message))

      });

    }

  }

}