import React, { useState } from 'react';
import './NavigationGuide.css';

/**
 * NavigationGuide
 * 
 * A floating question mark button in the bottom-right that opens
 * a navigation tutorial modal.
 */
function NavigationGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="guide-fab"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation guide"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="guide-overlay" onClick={() => setIsOpen(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <button className="guide-close" onClick={() => setIsOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <header className="guide-header">
              <h2>System Calibration</h2>
              <p>Operational Telemetry & Controls</p>
            </header>

            <div className="guide-content">
              <section className="guide-step">
                <div className="guide-step__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div className="guide-step__text">
                  <h3>Orbital Selection</h3>
                  <p>Tap any celestial body to initiate a cinematic transit and establish a <strong>holographic data link</strong>.</p>
                </div>
              </section>

              <section className="guide-step">
                <div className="guide-step__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </div>
                <div className="guide-step__text">
                  <h3>Quick Navigation</h3>
                  <p>Access the <strong>sliding terminal</strong> on the left to instantly warp between professional experiences and technical builds.</p>
                </div>
              </section>

              <section className="guide-step">
                <div className="guide-step__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                </div>
                <div className="guide-step__text">
                  <h3>Free-Cam Flight</h3>
                  <p>Drag to manipulate <strong>rotation</strong>, pinch or Ctrl + scroll to control <strong>zoom</strong>. The environment is a fully unlocked 3D space.</p>
                </div>
              </section>

              <section className="guide-step">
                <div className="guide-step__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                    <rect x="7" y="2" width="10" height="20" rx="5" />
                    <line x1="12" y1="6" x2="12" y2="10" />
                  </svg>
                </div>
                <div className="guide-step__text">
                  <h3>Scroll Warp</h3>
                  <p>Scroll <strong>down</strong> to jump outward from the Sun to the next planet, <strong>up</strong> to jump back. Hovering over a text panel scrolls the text instead.</p>
                </div>
              </section>

              <section className="guide-step">
                <div className="guide-step__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </div>
                <div className="guide-step__text">
                  <h3>Abort to Overview</h3>
                  <p>Select the <strong>back chevron</strong> in the top-left to disengage targets and return to a macro view of the system.</p>
                </div>
              </section>
            </div>

            <button className="guide-cta" onClick={() => setIsOpen(false)}>
              Acknowledge & Initiate
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default NavigationGuide;
