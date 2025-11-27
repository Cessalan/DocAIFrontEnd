import React, { useMemo } from 'react';
import './HospitalHallway.css';

/**
 * HospitalHallway - Premium HD hospital corridor visualization
 * Features dark/light mode support matching QuizRoomLanding theme
 * High-end hospital aesthetic with smooth animations
 */
function HospitalHallway({ progress = 0, isComplete = false }) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Calculate current stage for lighting effects
  const stage = useMemo(() => {
    if (isComplete) return 5;
    if (clampedProgress >= 80) return 4;
    if (clampedProgress >= 60) return 3;
    if (clampedProgress >= 40) return 2;
    if (clampedProgress >= 20) return 1;
    return 0;
  }, [clampedProgress, isComplete]);

  // Room numbers for the doors - odd numbers like real hospitals
  const rooms = ['201', '203', '205', '207', '209', '211', '213', '215', '217'];

  return (
    <div className={`hospital-corridor stage-${stage}`}>
      {/* Ambient lighting overlay */}
      <div className="ambient-light" />

      {/* Pulsing ambient glow */}
      <div className="ambient-glow" />

      {/* Scrolling corridor container */}
      <div
        className="corridor-track"
        style={{ '--progress': clampedProgress }}
      >
        {/* Ceiling with recessed lighting */}
        <div className="corridor-ceiling">
          <div className="ceiling-panels">
            {[...Array(14)].map((_, i) => (
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

        {/* Main wall section */}
        <div className="corridor-wall">
          {/* Upper wall section */}
          <div className="wall-upper" />

          {/* Glass accent stripe */}
          <div className="wall-accent" />

          {/* Lower wall section */}
          <div className="wall-lower" />

          {/* Metal handrail */}
          <div className="handrail">
            <div className="handrail-bar" />
            {[...Array(24)].map((_, i) => (
              <div
                key={i}
                className="handrail-bracket"
                style={{ left: `${i * 4.2}%` }}
              />
            ))}
          </div>

          {/* Premium Hospital Doors */}
          {rooms.map((roomNum, index) => (
            <div
              key={roomNum}
              className={`corridor-door ${
                roomNum === '217' ? 'destination' : ''
              } ${
                roomNum === '217' && stage >= 4 ? 'approaching' : ''
              } ${
                roomNum === '217' && isComplete ? 'arrived' : ''
              }`}
              style={{ left: `${7 + index * 10}%` }}
            >
              {/* Premium door frame with molding */}
              <div className="door-frame">
                {/* Frame top cap */}
                <div className="frame-cap" />

                {/* Frame left pillar */}
                <div className="frame-pillar left" />

                {/* Frame right pillar */}
                <div className="frame-pillar right" />

                {/* Main door surface */}
                <div className="door-surface">
                  {/* Vision panel (window) with wire glass */}
                  <div className="door-vision-panel">
                    <div className="vision-glass">
                      <div className="wire-pattern" />
                      <div className="glass-reflection" />
                      <div className="glass-inner-glow" />
                    </div>
                    <div className="vision-frame" />
                  </div>

                  {/* Push plate */}
                  <div className="door-push-plate">
                    <div className="push-plate-texture" />
                  </div>

                  {/* Premium lever handle */}
                  <div className="door-handle-assembly">
                    <div className="handle-escutcheon">
                      <div className="handle-keyhole" />
                    </div>
                    <div className="handle-lever">
                      <div className="lever-grip" />
                    </div>
                  </div>

                  {/* Door edge detail */}
                  <div className="door-edge" />

                  {/* Subtle door seam */}
                  <div className="door-seam" />
                </div>

                {/* Digital room number display */}
                <div className="room-number-display">
                  <div className="display-screen">
                    <span className="room-number">{roomNum}</span>
                  </div>
                  <div className="display-indicator" />
                </div>

                {/* Door status light */}
                <div className="door-status-light">
                  <div className="status-led" />
                </div>
              </div>

              {/* Glow effect for destination room 217 */}
              {roomNum === '217' && <div className="door-glow" />}
            </div>
          ))}
        </div>

        {/* Floor section */}
        <div className="corridor-floor">
          <div className="floor-surface" />
          <div className="floor-reflection" />
          <div className="floor-guideline" />
        </div>
      </div>

      {/* Serum presence indicator glow */}
      <div className="serum-presence" />

      {/* Cinematic vignette overlay */}
      <div className="corridor-vignette" />
    </div>
  );
}

export default HospitalHallway;
