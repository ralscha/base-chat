import { AbstractControl, ValidationErrors } from '@angular/forms';

export function passwordsMatch(
  firstControlName: string,
  secondControlName: string,
): (control: AbstractControl) => ValidationErrors | null {
  return (control: AbstractControl): ValidationErrors | null => {
    const first = control.get(firstControlName)?.value;
    const second = control.get(secondControlName)?.value;
    return first && second && first !== second ? { passwordsMismatch: true } : null;
  };
}
