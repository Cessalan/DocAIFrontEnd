import React, { useMemo } from 'react';
import './HospitalHallway.css';

/**
 * HospitalHallway - Premium hospital corridor visualization
 * Clean, modern medical facility aesthetic with smooth animations
 */
function HospitalHallway({ progress = 0, isComplete = false }) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const stage = useMemo(() => {
    if (isComplete) return 5;
    if (clampedProgress >= 80) return 4;
    if (clampedProgress >= 60) return 3;
    if (clampedProgress >= 40) return 2;
    if (clampedProgress >= 20) return 1;
    return 0;
  }, [clampedProgress, isComplete]);

  // Room numbers for the doors
  const rooms = ['201', '203', '205', '207', '209', '211', '213', '215', '217'];

  return (
    <div className={`hospital-corridor stage-${stage}`}>
      {/* Ambient light overlay */}
      <div className="ambient-light" />

      {/* Scrolling container */}
      <div
        className="corridor-track"
        style={{ '--progress': clampedProgress }}
      >
        {/* Ceiling */}
        <div className="corridor-ceiling">
          <div className="ceiling-panels">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="ceiling-panel">
                <div className={`ceiling-light ${stage >= 1 ? 'on' : ''}`}>
                  <div className="light-tube" />
                  <div className="light-tube" />
                  <div className="light-bloom" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main wall */}
        <div className="corridor-wall">
          {/* Upper wall section */}
          <div className="wall-upper" />

          {/* Accent stripe */}
          <div className="wall-accent" />

          {/* Lower wall section */}
          <div className="wall-lower" />

          {/* Handrail */}
          <div className="handrail">
            <div className="handrail-bar" />
            {[...Array(20)].map((_, i) => (
              <div key={i} className="handrail-bracket" style={{ left: `${i * 5}%` }} />
            ))}
          </div>

          {/* Doors */}
          {rooms.map((roomNum, index) => (
            <div
              key={roomNum}
              className={`corridor-door ${roomNum === '217' ? 'destination' : ''} ${roomNum === '217' && stage >= 4 ? 'approaching' : ''} ${roomNum === '217' && isComplete ? 'arrived' : ''}`}
              style={{ left: `${8 + index * 10}%` }}
            >
              {/* Door frame */}
              <div className="door-frame">
                {/* Door surface */}
                <div className="door-surface">
                  {/* Door panels */}
                  <div className="door-panel-top" />
                  <div className="door-panel-bottom" />

                  {/* Window */}
                  <div className="door-window">
                    <div className="window-reflection" />
                  </div>

                  {/* Handle assembly */}
                  <div className="handle-plate">
                    <div className="door-handle" />
                  </div>
                </div>

                {/* Room number */}
                <div className="room-plate">
                  <span>{roomNum}</span>
                </div>
              </div>

              {/* Glow effect for 217 */}
              {roomNum === '217' && <div className="door-glow" />}
            </div>
          ))}
        </div>

        {/* Floor */}
        <div className="corridor-floor">
          <div className="floor-surface" />
          <div className="floor-reflection" />
          <div className="floor-guideline" />
        </div>
      </div>

      {/* Serum presence indicator */}
      <div className="serum-presence" />

      {/* Vignette */}
      <div className="corridor-vignette" />

      {/* Progress indicator */}
      <div className="corridor-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ transform: `scaleX(${clampedProgress / 100})` }}
          />
        </div>
        <span className="progress-label">
          {isComplete ? 'Room 217' : `${Math.round(clampedProgress)}%`}
        </span>
      </div>
    </div>
  );
}

export default HospitalHallway;
