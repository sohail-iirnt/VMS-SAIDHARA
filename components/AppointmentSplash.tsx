"use client";

import styles from "./AppointmentSplash.module.css";

export default function AppointmentSplash() {
  return (
    <main className={styles.screen} role="status" aria-live="polite" aria-label="Loading Saidhara NDC visitor appointments">
      <div className={styles.softOrb} aria-hidden="true" />
      <section className={styles.content}>
        <div className={styles.animation} aria-hidden="true">
          <span className={styles.halo} />
          <span className={styles.halo} />
          <span className={styles.halo} />
          <span className={styles.ring} />
          <span className={styles.ring} />
          <span className={styles.ring} />
          <span className={styles.spark + " " + styles.sparkOne} />
          <span className={styles.spark + " " + styles.sparkTwo} />
          <span className={styles.spark + " " + styles.sparkThree} />
          <span className={styles.spark + " " + styles.sparkFour} />
          <div className={styles.logoPlate}>
            <img src="/GODREJ%20UPDATED%20LOGO%20NEW.png" alt="" className={styles.logo} />
          </div>
        </div>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>GODREJ &amp; BOYCE</span>
          <h1>VISITOR AND ASSET<br className={styles.desktopBreak} /> MANAGEMENT SYSTEM</h1>
          <p>NDC SAIDHARA</p>
        </div>
        <div className={styles.loadingTrack} aria-hidden="true"><span /></div>
        <span className={styles.loadingLabel}>Preparing your appointment experience</span>
      </section>
      <span className={styles.footer}>A safer, smoother welcome to Saidhara NDC</span>
    </main>
  );
}
