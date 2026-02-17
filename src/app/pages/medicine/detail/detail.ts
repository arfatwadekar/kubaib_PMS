import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MedicineService, Medicine } from 'src/app/services/medicine.service';

@Component({
  selector: 'app-medicine-detail',
  templateUrl: './detail.html',
  styleUrls: ['./detail.scss'],
  standalone: false,
})
export class DetailPage implements OnInit {

  form!: FormGroup;
  isEdit = false;
  id!: number;

  existingMedicines: Medicine[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private medicineService: MedicineService,
  ) {}

  ngOnInit(): void {
    this.initForm();

    const paramId = this.route.snapshot.paramMap.get('id');

    if (paramId) {
      // EDIT MODE
      this.isEdit = true;
      this.id = +paramId;
      this.loadMedicine();
    } else {
      // CREATE MODE
      this.isEdit = false;
      this.loadAllMedicines();
    }
  }

  initForm() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      strength: ['', Validators.required],
      dosageForm: ['', Validators.required],
      stockQuantity: [0, Validators.required],
      unit: ['', Validators.required],
      batchNumber: [''],
      expiryDate: [''],
      notes: [''],
    });
  }

  // Load single medicine (edit)
  loadMedicine() {
    this.medicineService.getById(this.id).subscribe(res => {
      this.form.patchValue(res);
    });
  }

  // Load all medicines for auto fill
loadAllMedicines() {
  this.medicineService.getAll(1, 1000).subscribe({
    next: (res) => {
      this.existingMedicines = res?.data?.items ?? [];
    },
    error: (err) => {
      console.error('Failed to load medicines', err);
      this.existingMedicines = [];
    }
  });
}

  // AUTO FILL BUTTON LOGIC
  autoFillTemplate() {

    if (!this.existingMedicines || this.existingMedicines.length === 0) {
      alert('No existing medicines found to auto fill.');
      return;
    }

    const template = this.existingMedicines[0]; // first record

    this.form.patchValue({
      name: template.name || '',
      strength: template.strength || '',
      dosageForm: template.dosageForm || '',
      unit: template.unit || '',
      stockQuantity: 0, // Always new stock
      batchNumber: '',
      expiryDate: '',
      notes: ''
    });

  }

  save() {
    if (this.form.invalid) return;

    const data = this.form.value;

    if (this.isEdit) {
      this.medicineService
        .update(this.id, data)
        .subscribe(() => this.router.navigate(['/medicines']));
    } else {
      this.medicineService
        .create(data)
        .subscribe(() => this.router.navigate(['/medicines']));
    }
  }

  cancel() {
    this.router.navigate(['/medicines']);
  }
}
