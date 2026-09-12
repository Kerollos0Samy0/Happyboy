export interface Department {
  id: string;
  name: string;
  email: string;
}

export const factoryDepartments: Department[] = [
  { id: "samples", name: "1 - قسم العينات", email: "dept_samples@happyboy.com" },
  { id: "fabric_order", name: "2 - اوردر قماش", email: "dept_fabric_order@happyboy.com" },
  { id: "fabric_warehouse", name: "3 - مخزن قماش", email: "dept_fabric_warehouse@happyboy.com" },
  { id: "cutting", name: "4 - قسم القص", email: "dept_cutting@happyboy.com" },
  { id: "sorting", name: "5 - قسم الفرز", email: "dept_sorting@happyboy.com" },
  { id: "printing_laser", name: "6 - قسم الطباعة - ليزر", email: "dept_printing_laser@happyboy.com" },
  { id: "cutting_hollow", name: "7 - قسم القص والتفريغ", email: "dept_cutting_hollow@happyboy.com" },
  { id: "pressing", name: "8 - قسم الكبس", email: "dept_pressing@happyboy.com" },
  { id: "preparation", name: "9 - قسم التجهيز", email: "dept_preparation@happyboy.com" },
  { id: "machinery", name: "10 - قسم المكن", email: "dept_machinery@happyboy.com" },
  { id: "finishing", name: "11 - قسم التشطيب", email: "dept_finishing@happyboy.com" },
  { id: "ironing", name: "12 - قسم المكواة", email: "dept_ironing@happyboy.com" },
  { id: "packing", name: "13 - التعبئة والتكييس", email: "dept_packing@happyboy.com" },
  { id: "models_warehouse", name: "14 - مخزن الموديلات", email: "dept_models_warehouse@happyboy.com" },
];
