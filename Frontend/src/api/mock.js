// ============================================================
//  MOCK DATA — delete each section when backend is ready
// ============================================================
const MOCK = {
  tenant: { id:"t_01", name:"HealthFirst Clinic", city:"Chennai", plan:"Pro", botActive:true },
  dashboard: { todayAppointments:7, newPatientsWeek:14, botMessages:238, remindersSent:12, confirmedToday:4 },
  appointments: [
    { id:"a1", patientName:"Meera Sharma",  phone:"+91 98765 43210", service:"General Checkup", date:"2025-03-08", time:"09:00 AM", status:"confirmed", reminderSent:true,  age:34, notes:"Follow-up for blood pressure", avatar:"MS" },
    { id:"a2", patientName:"Rajesh Kumar",  phone:"+91 87654 32109", service:"Dental Cleaning", date:"2025-03-08", time:"10:30 AM", status:"confirmed", reminderSent:true,  age:51, notes:"",                              avatar:"RK" },
    { id:"a3", patientName:"Sunita Patel",  phone:"+91 76543 21098", service:"Blood Test",       date:"2025-03-08", time:"11:00 AM", status:"pending",   reminderSent:false, age:28, notes:"Fasting required",             avatar:"SP" },
    { id:"a4", patientName:"Arun Verma",    phone:"+91 65432 10987", service:"Consultation",     date:"2025-03-08", time:"12:15 PM", status:"pending",   reminderSent:false, age:45, notes:"",                              avatar:"AV" },
    { id:"a5", patientName:"Kavya Nair",    phone:"+91 54321 09876", service:"X-Ray",            date:"2025-03-08", time:"02:00 PM", status:"confirmed", reminderSent:true,  age:22, notes:"Chest X-ray",                   avatar:"KN" },
    { id:"a6", patientName:"Deepak Joshi",  phone:"+91 43210 98765", service:"ECG",              date:"2025-03-08", time:"03:30 PM", status:"cancelled", reminderSent:false, age:62, notes:"Patient rescheduling",           avatar:"DJ" },
    { id:"a7", patientName:"Priya Singh",   phone:"+91 32109 87654", service:"General Checkup",  date:"2025-03-09", time:"09:30 AM", status:"pending",   reminderSent:false, age:38, notes:"",                              avatar:"PS" },
    { id:"a8", patientName:"Vikram Mehta",  phone:"+91 21098 76543", service:"Consultation",     date:"2025-03-09", time:"11:00 AM", status:"confirmed", reminderSent:true,  age:55, notes:"",                              avatar:"VM" },
  ],
};

export default MOCK;
