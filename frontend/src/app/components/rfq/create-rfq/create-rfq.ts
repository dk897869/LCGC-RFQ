import { Component } from '@angular/core';
import { RfqService } from '../../../services/rfq.services';

@Component({
  selector: 'app-create-rfq',
  templateUrl: './create-rfq.html'
})
export class CreateRfqComponent {

  title = '';
  description = '';
  deadline = '';

  constructor(private rfqService: RfqService) {}

  create() {

    if (!this.title || !this.description) {
      alert("Please fill all fields");
      return;
    }

    this.rfqService.create({
      title: this.title,
      description: this.description,
      deadline: this.deadline
    }).subscribe({
      next: () => {
        alert("RFQ Created Successfully");
        this.resetForm();
      },
      error: (err: unknown) => {
        console.error(err);
        alert("Error creating RFQ");
      }
    });
  }

  resetForm() {
    this.title = '';
    this.description = '';
    this.deadline = '';
  }
}
