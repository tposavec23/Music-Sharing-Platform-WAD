import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info.html',
  styleUrls: ['./info.scss']
})
export class InfoPage {
  teamMembers = [
    {
      name: 'Tin Posavec',
      role: 'Backend Developer',
      faculty: 'Faculty of Organization and Informatics',
      university: 'University of Zagreb'
    },
    {
      name: 'Oliwier Jaszczyk',
      role: 'Frontend Developer',
      faculty: 'Faculty of Mathematics and Computer Science',
      university: 'University Lodz'
    }
  ];

  downloadFile(filename: string) {
    window.open(`/assets/docs/${filename}`, '_blank');
  }
}
