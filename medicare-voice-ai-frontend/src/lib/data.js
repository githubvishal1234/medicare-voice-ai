export const org = {
  name: "HealthLink Clinic",
  plan: "Professional Plan",
  admin: "Admin",
};

export const patients = [
  {
    id: "sarah-jenkins",
    mrn: "MRN-94827-X",
    name: "Sarah Jenkins",
    dob: "Oct 12, 1945",
    age: 78,
    phone: "(555) 867-5309",
    doctor: "Dr. Robert Chen (Primary)",
    status: "Active",
    initials: "SJ",
    vitals: { bp: "128/82", bpTrend: "down", hr: "72 bpm", weight: "142 lbs", recorded: "Oct 10, 2023" },
    prescriptions: [
      { name: "Lisinopril 10mg", detail: "1 tablet daily (Hypertension)", status: "Refill Soon", note: "7 days left" },
      { name: "Atorvastatin 20mg", detail: "1 tablet at bedtime (Cholesterol)", status: "Active", note: "45 days left" },
    ],
    interactions: [
      { title: "Routine Check-in", date: "Yesterday, 10:30 AM", detail: "Patient reported mild dizziness when standing. AI Agent successfully scheduled follow-up for next Tuesday.", hasAudio: true, duration: "2:14" },
      { title: "Medication Reminder", date: "Oct 15, 2023", detail: "Completed successfully" },
      { title: "Appointment Confirmation", date: "Oct 02, 2023", detail: "Rescheduled — patient requested new time" },
    ],
    appointments: [
      { title: "Cardiology Follow-up", when: "Next Tue, Oct 24 · 2:00 PM", location: "Main Clinic, Room 3B", status: "upcoming" },
      { title: "Annual Physical", when: "Oct 10, 2023", location: "Completed", status: "done" },
    ],
  },
  {
    id: "michael-chen",
    mrn: "MRN-70213-B",
    name: "Michael Chen",
    dob: "Mar 3, 1978",
    age: 47,
    phone: "(555) 220-4471",
    doctor: "Dr. Robert Chen (Primary)",
    status: "Active",
    initials: "MC",
    vitals: { bp: "118/76", bpTrend: "flat", hr: "68 bpm", weight: "178 lbs", recorded: "Oct 8, 2023" },
    prescriptions: [
      { name: "Amoxicillin 500mg", detail: "3x daily (Post-op infection)", status: "Active", note: "3 days left" },
    ],
    interactions: [
      { title: "Post-op Symptoms", date: "Today, 09:15 AM", detail: "Reported mild swelling. Transferred to on-call nurse for review.", hasAudio: true, duration: "5:30" },
    ],
    appointments: [
      { title: "Post-op Review", when: "Fri, Oct 27 · 11:00 AM", location: "Main Clinic, Room 2A", status: "upcoming" },
    ],
  },
];

export const callLogs = [
  { id: 1, patient: "Sarah Jenkins", timestamp: "Today, 09:42 AM", reason: "Rescheduling", duration: "2m 14s", outcome: "Booked", sentiment: "Positive" },
  { id: 2, patient: "Michael Chen", timestamp: "Today, 09:15 AM", reason: "Post-op Symptoms", duration: "5m 30s", outcome: "Transferred to Nurse", sentiment: "Concerned" },
  { id: 3, patient: "Unknown Caller", timestamp: "Today, 08:50 AM", reason: "Clinic Hours", duration: "0m 45s", outcome: "FAQ Answered", sentiment: "Neutral" },
  { id: 4, patient: "Elena Rodriguez", timestamp: "Yesterday, 04:20 PM", reason: "New Patient", duration: "4m 10s", outcome: "Booked", sentiment: "Positive" },
];

export const transcript = [
  { who: "ai", text: "Hello, thank you for calling HealthLink Clinic. I'm MedVoice, the AI assistant. How can I help you today?", time: "00:02" },
  { who: "patient", text: "Hi, this is Sarah Jenkins. I need to reschedule my appointment for tomorrow. My car broke down.", time: "00:10" },
  { who: "ai", text: "I can help with that, Sarah. I see you have a follow-up with Dr. Smith tomorrow at 10:00 AM. I have openings next Tuesday at 2:00 PM or Thursday at 9:00 AM. Would either of those work for you?", time: "00:18" },
  { who: "patient", text: "Tuesday at 2:00 PM would be perfect.", time: "00:32" },
];

export const liveCalls = [
  { name: "Unknown Caller", meta: "0:45 · English", status: "Booking in progress", tone: "info" },
  { name: "Sarah Jenkins", meta: "1:12 · Spanish", status: "Verifying insurance", tone: "warning" },
  { name: "Michael Chen", meta: "0:20 · English", status: "Greeting", tone: "neutral" },
];

export const callVolume = [12, 14, 11, 8, 9, 18, 22, 27, 31, 24, 34, 20, 15];

export const appointments = [
  { day: "Mon 12", time: "8:00 AM", title: "Dr. Smith – Consult", patient: "Sarah Jenkins", ai: true },
  { day: "Tue 13", time: "9:00 AM", title: "Dr. Allen – Follow Up", patient: "Michael Chang", ai: false },
  { day: "Tue 13", time: "9:00 AM", title: "Dr. Smith – New Patient", patient: "Emily Roberts", ai: true },
  { day: "Wed 14", time: "10:00 AM", title: "Dr. Allen – Consult", patient: "David Miller", ai: false },
];

export const pendingBookings = [
  { name: "James Wilson", type: "Follow-up · Dr. Smith", when: "Tomorrow, 9:30 AM" },
  { name: "Amanda Cole", type: "New Patient · Dr. Allen", when: "Thu 15, 2:00 PM" },
];

export const ehrIntegrations = [
  { name: "Epic Systems", status: "Connected — Real-time", connected: true, detail: "Bidirectional sync active for patient demographics, scheduling, clinical notes, and medication histories.", meta1: ["Last Sync", "2 mins ago"], meta2: ["Data Transferred (24h)", "1.2 GB"] },
  { name: "Oracle Cerner", status: "Not Connected", connected: false, detail: "Enable integration to pull patient records and push AI-generated clinical summaries directly into Cerner Millennium.", note: "Requires IT Administrator credentials and API access enabled in your Cerner environment." },
  { name: "athenahealth", status: "Connected — Scheduled", connected: true, detail: "Syncing appointments, billing codes, and demographic updates every 15 minutes.", meta1: ["Next sync in", "4m 12s"] },
  { name: "Veradigm (Allscripts)", status: "Not Connected", connected: false, detail: "Connect to Veradigm EHR to synchronize clinical workflows and voice-to-text transcriptions." },
];

export const auditLog = [
  { time: "Today, 10:42 AM", action: "EHR Sync Triggered", who: "System (Auto)", status: "Success" },
  { time: "Today, 09:15 AM", action: "AI Greeting Updated", who: "Dr. Sarah Jenkins", status: "Success" },
  { time: "Yesterday, 4:30 PM", action: "Failed Login Attempt", who: "Unknown (IP: 192.168.1.1)", status: "Blocked" },
  { time: "Yesterday, 2:00 PM", action: "API Key Rotated", who: "Admin (Mark D.)", status: "Success" },
  { time: "Oct 24, 11:20 AM", action: "Patient Record Accessed", who: "Voice Agent Alpha", status: "Logged" },
];

export const invoices = [
  { id: "INV-2023-1001", date: "Oct 1, 2023", amount: "$499.00", status: "Paid" },
  { id: "INV-2023-0901", date: "Sep 1, 2023", amount: "$499.00", status: "Paid" },
  { id: "INV-2023-0801", date: "Aug 1, 2023", amount: "$499.00", status: "Paid" },
];
