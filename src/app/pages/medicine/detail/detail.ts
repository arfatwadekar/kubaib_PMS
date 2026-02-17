import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
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
  loading = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private medicineService: MedicineService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  // ===============================
  // INIT
  // ===============================
  ngOnInit(): void {
    this.initForm();

    const paramId = this.route.snapshot.paramMap.get('id');

    if (paramId) {
      this.isEdit = true;
      this.id = +paramId;
      this.loadMedicine();
    } else {
      this.isEdit = false;
      this.loadAllMedicines();
    }
  }

  // ===============================
  // FORM INIT
  // ===============================
  private initForm(): void {
    this.form = this.fb.group({
      name: [''],
      strength: [''],
      dosageForm: [''],
      stockQuantity: [0],
      unit: [''],
      batchNumber: [''],
      expiryDate: [''],
      notes: ['']
    });
  }

  // ===============================
  // LOAD SINGLE MEDICINE
  // ===============================
  private loadMedicine(): void {
    this.loading = true;

    this.medicineService.getById(this.id).subscribe({
      next: (res) => {
        this.form.patchValue(res);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Failed to load medicine.', 'danger');
      }
    });
  }

  // ===============================
  // LOAD ALL MEDICINES (FOR DUPLICATE CHECK)
  // ===============================
  private loadAllMedicines(): void {
    this.medicineService.getAll(1, 1000).subscribe({
      next: (res) => {
        this.existingMedicines = res?.data?.items ?? [];
      },
      error: () => {
        this.existingMedicines = [];
        this.showToast('Failed to load medicines list.', 'danger');
      }
    });
  }

  // ===============================
  // AUTO FILL TEMPLATE
  // ===============================
  autoFillTemplate(): void {
    if (!this.existingMedicines.length) {
      this.showToast('No existing medicines available.', 'warning');
      return;
    }

    const template = this.existingMedicines[0];

    this.form.patchValue({
      name: template.name || '',
      strength: template.strength || '',
      dosageForm: template.dosageForm || '',
      unit: template.unit || '',
      stockQuantity: 0,
      batchNumber: '',
      expiryDate: '',
      notes: ''
    });

    this.showToast('Template applied successfully.', 'success');
  }

  // ===============================
  // SAVE (PROFESSIONAL FLOW)
  // ===============================
  async save(): Promise<void> {

    const data = this.form.value;

    // -------- BASIC VALIDATION --------
    if (!data.name?.trim()) {
      this.showToast('Medicine name is required.', 'warning');
      return;
    }

    if (!data.strength?.trim()) {
      this.showToast('Strength is required.', 'warning');
      return;
    }

    if (!data.dosageForm?.trim()) {
      this.showToast('Dosage form is required.', 'warning');
      return;
    }

    if (!data.unit?.trim()) {
      this.showToast('Unit is required.', 'warning');
      return;
    }

    // -------- DUPLICATE CHECK (CREATE ONLY) --------
    if (!this.isEdit) {

      const duplicate = this.existingMedicines.find(m =>
        m.name?.toLowerCase().trim() === data.name.toLowerCase().trim() &&
        m.strength?.toLowerCase().trim() === data.strength.toLowerCase().trim() &&
        m.dosageForm?.toLowerCase().trim() === data.dosageForm.toLowerCase().trim()
      );

      if (duplicate) {
        const confirmed = await this.confirmDuplicate();
        if (!confirmed) return;
      }
    }

    this.loading = true;

    // -------- API CALL --------
    if (this.isEdit) {
      this.medicineService.update(this.id, data).subscribe({
        next: () => {
          this.loading = false;
          this.showToast('Medicine updated successfully.', 'success');
          this.router.navigate(['/medicines']);
        },
        error: () => {
          this.loading = false;
          this.showToast('Failed to update medicine.', 'danger');
        }
      });
    } else {
      this.medicineService.create(data).subscribe({
        next: () => {
          this.loading = false;
          this.showToast('Medicine created successfully.', 'success');
          this.router.navigate(['/medicines']);
        },
        error: () => {
          this.loading = false;
          this.showToast('Failed to create medicine.', 'danger');
        }
      });
    }
  }

  // ===============================
  // DUPLICATE CONFIRM POPUP
  // ===============================
  private async confirmDuplicate(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: 'Medicine Already Exists',
        message: 'A medicine with same details already exists. Do you want to continue?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Continue',
            handler: () => resolve(true)
          }
        ]
      });

      await alert.present();
    });
  }

  // ===============================
  // CANCEL
  // ===============================
  cancel(): void {
    this.router.navigate(['/medicines']);
  }

  // ===============================
  // TOAST
  // ===============================
  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });

    await toast.present();
  }
}
