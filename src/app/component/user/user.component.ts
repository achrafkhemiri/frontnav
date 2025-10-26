import { Component } from '@angular/core';
import { UserControllerService } from '../api/api/userController.service';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css']
})
export class UserComponent {
  constructor(public userService: UserControllerService) {}
}
