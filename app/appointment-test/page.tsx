"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import styles from "./page.module.css";

const LOCATIONS = [
  { id: "ADMIN", name: "Main Admin Office", short: "Admin Office" },
  { id: "I", name: "Warehouse I", short: "Warehouse I" },
  { id: "J", name: "Warehouse J", short: "Warehouse J" },
  { id: "K", name: "Warehouse K", short: "Warehouse K" },
  { id: "L", name: "Warehouse L", short: "Warehouse L" },
  { id: "O", name: "Warehouse O", short: "Warehouse O" },
  { id: "P", name: "Warehouse P", short: "Warehouse P" },
  { id: "Q", name: "Warehouse Q", short: "Warehouse Q" },
  { id: "R", name: "Warehouse R", short: "Warehouse R" },
  { id: "S", name: "Warehouse S", short: "Warehouse S" },
  { id: "T", name: "Warehouse T", short: "Warehouse T" },
  { id: "H14-MHE", name: "H14 (MHE)", short: "H14 · MHE" }
];

const PURPOSES = ["Meeting", "Visitor", "Official", "Interview", "Delivery", "Others"];
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const refNo = () => `APT-${today().replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;

type FormState = {
  locationId: string;
  appointmentDate: string;
  appointmentTime: string;
  visitorName: string;
  company: string;
  mobile: string;
  email: string;
  hostName: string;
  purpose: string;
  remarks: string;
  photoUrl: string;
};

const initialForm = (): FormState => ({
  locationId: "",
  appointmentDate: today(),
  appointmentTime: "10:00",
  visitorName: "",
  company: "",
  mobile: "",
  email: "",
  hostName: "",
  purpose: "Meeting",
  remarks: "",
  photoUrl: ""
});

export default function AppointmentBookingV2() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ appointmentNo: string; locationName: string; date: string; time: string; visitorName: string } | null>(null);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectedLocation = useMemo(
    () => LOCATIONS.find((location) => location.id === form.locationId),
    [form.locationId]
  );

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraOpen(false);
  };

  const openCamera = async () => {
    setCameraError("");
    setCameraReady(false);
    if (!window.isSecureContext) {
      setCameraError("Camera access requires a secure HTTPS page.");
      setCameraOpen(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera is not available here. Use Choose photo instead.");
      setCameraOpen(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (err: any) {
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access and try again."
          : "Could not open the camera. You can continue without a photo."
      );
      setCameraOpen(true);
    }
  };

  const captureCamera = () => {
    const video = videoRef.current;
    if (!video || !cameraReady || video.readyState < 2 || !video.videoWidth) {
      setCameraError("The camera is still starting. Please wait a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    const max = 900;
    const scale = Math.min(1, max / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    update("photoUrl", canvas.toDataURL("image/jpeg", 0.72));
    stopCamera();
  };

  const attachPhoto = async (file?: File) => {
    if (!file) return;
    try {
      if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read the photo."));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not process the photo."));
        img.src = data;
      });
      const max = 900;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      update("photoUrl", canvas.toDataURL("image/jpeg", 0.68));
      setError("");
    } catch (err: any) {
      setError(err.message || "Could not attach photo.");
    }
  };

  const canContinue = step === 1
    ? Boolean(form.locationId && form.appointmentDate && form.appointmentTime)
    : Boolean(form.visitorName.trim() && form.mobile.trim() && form.hostName.trim());

  const next = () => {
    setError("");
    if (!canContinue) {
      setError(step === 1 ? "Please select the location, date and time." : "Please complete the required visitor details.");
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setError("");
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step === 1) return next();
    setSaving(true);
    setError("");
    try {
      if (!form.locationId || !selectedLocation) throw new Error("Please select the location you are visiting.");
      if (form.appointmentDate < today()) throw new Error("Appointment date cannot be in the past.");
      if (!form.visitorName.trim() || !form.mobile.trim() || !form.hostName.trim()) {
        throw new Error("Please complete all required visitor details.");
      }

      const appointmentNo = refNo();
      await addDoc(collection(db, "visitorAppointments"), {
        appointmentNo,
        locationId: form.locationId,
        locationName: selectedLocation.name,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        visitorName: form.visitorName.trim(),
        company: form.company.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        hostName: form.hostName.trim(),
        purpose: form.purpose,
        remarks: form.remarks.trim(),
        photoUrl: form.photoUrl || "",
        status: "PENDING",
        createdAt: Timestamp.now()
      });

      setDone({
        appointmentNo,
        locationName: selectedLocation.name,
        date: form.appointmentDate,
        time: form.appointmentTime,
        visitorName: form.visitorName.trim()
      });
    } catch (err: any) {
      setError(err.message || "Unable to submit appointment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const startAgain = () => {
    setForm(initialForm());
    setStep(1);
    setDone(null);
    setError("");
  };

  if (done) {
    return (
      <main className={styles.page}>
        <div className={styles.ambient} />
        <section className={styles.successShell}>
          <div className={styles.brandRow}>
            <div className={styles.logoMark}>V</div>
            <div><strong>Godrej &amp; Boyce</strong><span>Saidhara NDC · Visitor Appointment</span></div>
          </div>
          <div className={styles.successIcon}><CheckCircle2 size={34} strokeWidth={2.4} /></div>
          <span className={styles.kicker}>REQUEST RECEIVED</span>
          <h1>Your appointment request is submitted.</h1>
          <p className={styles.successLead}>Your visit is now awaiting approval. Save your appointment reference and show it when you arrive.</p>
          <div className={styles.ticket}>
            <div className={styles.ticketTop}><span>Appointment reference</span><strong>{done.appointmentNo}</strong></div>
            <div className={styles.ticketGrid}>
              <div><span>Visitor</span><b>{done.visitorName}</b></div>
              <div><span>Location</span><b>{done.locationName}</b></div>
              <div><span>Date</span><b>{done.date}</b></div>
              <div><span>Time</span><b>{done.time} IST</b></div>
            </div>
            <div className={styles.pending}><span className={styles.dot} /> Awaiting approval</div>
          </div>
          <button className={styles.primaryButton} type="button" onClick={startAgain}>Book another appointment <ArrowRight size={17} /></button>
          <p className={styles.smallNote}>Please carry a valid photo ID when you arrive. We look forward to welcoming you.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} />
      <div className={styles.layout}>
        <aside className={styles.intro}>
          <div className={styles.brandRow}>
            <div className={styles.logoMark}>V</div>
            <div><strong>VMS NDC</strong><span>Godrej &amp; Boyce · Visitor Access</span></div>
          </div>
          <div className={styles.introContent}>
            <span className={styles.kicker}>WELCOME TO SAIDHARA NDC</span>
            <h1>Book your visit.<br /><em>We'll be ready.</em></h1>
            <p>Make your appointment before you arrive. It only takes a couple of minutes, and you can complete it comfortably from your phone.</p>
            <div className={styles.promiseList}>
              <div><span><ShieldCheck size={17} /></span><div><b>Quick &amp; easy</b><small>No account or login needed.</small></div></div>
              <div><span><Clock3 size={17} /></span><div><b>Choose your visit</b><small>Pick your destination, date and time.</small></div></div>
              <div><span><Sparkles size={17} /></span><div><b>Easy arrival</b><small>Keep your appointment reference with you.</small></div></div>
            </div>
          </div>
          <div className={styles.sideFoot}>VMS NDC · Visitor &amp; Asset Management</div>
        </aside>

        <section className={styles.formShell}>
          <div className={styles.mobileBrand}>
            <div className={styles.brandRow}><div className={styles.logoMark}>V</div><div><strong>Godrej &amp; Boyce</strong><span>Saidhara NDC</span></div></div>
            <span className={styles.secure}><ShieldCheck size={14} /> Secure</span>
          </div>

          <div className={styles.formHeader}>
            <div>
              <span className={styles.stepLabel}>{step === 1 ? "START YOUR VISIT" : "YOUR DETAILS"}</span>
              <h2>{step === 1 ? "Where are you visiting?" : "A little about you"}</h2>
              <p>{step === 1 ? "First, tell us where and when you plan to visit." : "These details help your host and security team prepare."}</p>
            </div>
            <div className={styles.progress}><span className={step === 1 ? styles.active : styles.complete}>{step === 1 ? "1" : <Check size={15} />}</span><i className={step === 2 ? styles.lineActive : ""} /><span className={step === 2 ? styles.active : ""}>2</span></div>
          </div>

          <form onSubmit={submit} className={styles.form}>
            {step === 1 ? (
              <div className={styles.stepBody}>
                <div className={styles.sectionLabel}><MapPin size={18} /><div><b>Where are you going?</b><small>Select the office or warehouse you are visiting.</small></div></div>
                <div className={styles.locationGrid}>
                  {LOCATIONS.map((location) => (
                    <button type="button" key={location.id} className={form.locationId === location.id ? styles.locationSelected : styles.locationCard} onClick={() => update("locationId", location.id)}>
                      <span className={styles.locationIcon}><MapPin size={16} /></span><span><b>{location.short}</b><small>{location.id === "ADMIN" ? "Main office" : location.id === "H14-MHE" ? "Material handling" : "Saidhara NDC"}</small></span>
                      {form.locationId === location.id && <span className={styles.check}><Check size={13} /></span>}
                    </button>
                  ))}
                </div>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}><span>Appointment date <b>*</b></span><div className={styles.inputWrap}><CalendarDays size={17} /><input type="date" min={today()} value={form.appointmentDate} onChange={(e) => update("appointmentDate", e.target.value)} required /></div></label>
                  <label className={styles.field}><span>Preferred time <b>*</b></span><div className={styles.inputWrap}><Clock3 size={17} /><input type="time" value={form.appointmentTime} onChange={(e) => update("appointmentTime", e.target.value)} required /></div></label>
                </div>
                <div className={styles.tip}><Clock3 size={16} /><span>Your request will be reviewed by the security team at your selected location.</span></div>
              </div>
            ) : (
              <div className={styles.stepBody}>
                <div className={styles.selectedSummary}><div className={styles.summaryIcon}><MapPin size={18} /></div><div><span>VISITING</span><b>{selectedLocation?.name}</b><small>{form.appointmentDate} · {form.appointmentTime} IST</small></div><button type="button" onClick={back}>Change</button></div>
                <div className={styles.sectionLabel}><UserRound size={18} /><div><b>About you</b><small>Just the details we need for your visit.</small></div></div>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}><span>Full name <b>*</b></span><div className={styles.inputWrap}><UserRound size={17} /><input autoFocus value={form.visitorName} onChange={(e) => update("visitorName", e.target.value)} placeholder="Your full name" required /></div></label>
                  <label className={styles.field}><span>Mobile number <b>*</b></span><div className={styles.inputWrap}><Phone size={17} /><input inputMode="tel" autoComplete="tel" value={form.mobile} onChange={(e) => update("mobile", e.target.value)} placeholder="10-digit mobile" required /></div></label>
                  <label className={styles.field}><span>Company / organisation</span><div className={styles.inputWrap}><UsersRound size={17} /><input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Company name" /></div></label>
                  <label className={styles.field}><span>Email address</span><div className={styles.inputWrap}><Mail size={17} /><input type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Optional" /></div></label>
                  <label className={styles.field}><span>Who are you meeting? <b>*</b></span><div className={styles.inputWrap}><UserRound size={17} /><input value={form.hostName} onChange={(e) => update("hostName", e.target.value)} placeholder="Name of host or employee" required /></div></label>
                  <label className={styles.field}><span>Purpose</span><div className={styles.inputWrap}><Sparkles size={17} /><select value={form.purpose} onChange={(e) => update("purpose", e.target.value)}>{PURPOSES.map((purpose) => <option key={purpose}>{purpose}</option>)}</select></div></label>
                </div>

                <div className={styles.photoCard}>
                  <div><span className={styles.photoIcon}><Camera size={18} /></span><div><b>Photo <small>Optional</small></b><p>Optional — this can help us identify you when you arrive.</p></div></div>
                  {form.photoUrl ? <div className={styles.photoPreview}><img src={form.photoUrl} alt="Visitor preview" /><button type="button" onClick={() => update("photoUrl", "")}><X size={15} /></button></div> : <div className={styles.photoActions}><button type="button" onClick={openCamera}><Camera size={16} /> Take photo</button><label><span>Choose photo</span><input type="file" accept="image/*" capture="user" onChange={(e) => attachPhoto(e.target.files?.[0])} /></label></div>}
                </div>

                <label className={styles.field}><span>Anything else to share?</span><textarea rows={3} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Optional message for your host or security team" /></label>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              {step === 2 && <button type="button" className={styles.backButton} onClick={back}><ChevronLeft size={18} /> Back</button>}
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                {saving ? "Booking your visit…" : step === 1 ? "Continue" : "Book my appointment"}
                {!saving && (step === 1 ? <ArrowRight size={17} /> : <Check size={17} />)}
              </button>
            </div>
          </form>

          <div className={styles.formFoot}><ShieldCheck size={15} /> Your details are used only to process your visitor appointment. No account is required.</div>
        </section>
      </div>

      {cameraOpen && <div className={styles.cameraOverlay} role="dialog" aria-modal="true">
        <div className={styles.cameraCard}>
          <div className={styles.cameraHead}><div><b>Take visitor photo</b><span>Position yourself inside the frame.</span></div><button type="button" onClick={stopCamera}><X size={18} /></button></div>
          {cameraError ? <div className={styles.cameraError}>{cameraError}</div> : <div className={styles.videoFrame}><video ref={videoRef} autoPlay playsInline muted onCanPlay={() => setCameraReady(true)} onLoadedMetadata={() => { if (videoRef.current?.videoWidth) setCameraReady(true); }} /></div>}
          <div className={styles.cameraActions}><button type="button" className={styles.backButton} onClick={stopCamera}>Cancel</button>{!cameraError && <button type="button" className={styles.primaryButton} onClick={captureCamera} disabled={!cameraReady}>{cameraReady ? "Capture photo" : "Starting…"}</button>}</div>
        </div>
      </div>}
    </main>
  );
}
