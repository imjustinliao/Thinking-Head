import { useInsertionEffect } from "react";

const STYLE_ID = "thinking-head-mech-styles";

const styles = `
.thm-indicator { --thm-loop: 4.8s; --thm-play: running; --thm-ink: currentColor; --thm-hot: #ffbd59; position: relative; display: inline-grid; width: var(--thm-size); height: var(--thm-size); place-items: center; color: inherit; isolation: isolate; }
.thm-svg { width: 100%; height: 100%; overflow: visible; }
.thm-frame, .thm-rover, .thm-arm, .thm-halo, .thm-sensor, .thm-wave, .thm-beam, .thm-plate, .thm-line, .thm-wheel { transform-box: fill-box; transform-origin: center; transition: transform 480ms cubic-bezier(.22,.8,.2,1), opacity 260ms ease; }
.thm-shell { fill: var(--thm-ink); fill-opacity: .13; stroke: var(--thm-ink); stroke-width: 3; stroke-linejoin: round; }
.thm-detail { fill: none; stroke: var(--thm-ink); stroke-width: 2.5; stroke-linecap: round; }
.thm-core { fill: var(--thm-hot); stroke: var(--thm-ink); stroke-width: 2.5; }
.thm-visor { fill: var(--thm-ink); opacity: .88; }
.thm-wheel { fill: none; stroke: var(--thm-ink); stroke-width: 3; stroke-dasharray: 4 3; }
.thm-rover, .thm-sensor, .thm-wave, .thm-beam, .thm-plate { opacity: 0; }
.thm-halo { opacity: .72; }
.thm-indicator[data-state="thinking"] .thm-frame { animation: thm-think var(--thm-loop) ease-in-out infinite; }
.thm-indicator[data-state="thinking"] .thm-halo { animation: thm-orbit calc(var(--thm-loop) * 1.15) linear infinite; }
.thm-indicator[data-state="thinking"] .thm-core { animation: thm-pulse var(--thm-loop) ease-in-out infinite; }
.thm-indicator[data-state="executing"] .thm-frame { transform: translateY(9px) scaleY(.72); }
.thm-indicator[data-state="executing"] .thm-arm { transform: rotate(38deg); }
.thm-indicator[data-state="executing"] .thm-halo { opacity: 0; transform: scale(.45); }
.thm-indicator[data-state="executing"] .thm-rover { opacity: 1; transform: translateY(5px); animation: thm-drive calc(var(--thm-loop) * .65) ease-in-out infinite; }
.thm-indicator[data-state="executing"] .thm-wheel { animation: thm-wheel calc(var(--thm-loop) * .22) linear infinite; }
.thm-indicator[data-state="executing"] .thm-core { animation: thm-power calc(var(--thm-loop) * .6) steps(2, end) infinite; }
.thm-indicator[data-state="listening"] .thm-sensor { opacity: 1; transform: translateY(-2px); animation: thm-listen var(--thm-loop) ease-in-out infinite; }
.thm-indicator[data-state="listening"] .thm-arm.left { transform: rotate(-16deg); }
.thm-indicator[data-state="listening"] .thm-arm.right { transform: rotate(16deg); }
.thm-indicator[data-state="listening"] .thm-wave { opacity: 1; animation: thm-wave var(--thm-loop) ease-out infinite; }
.thm-indicator[data-state="searching"] .thm-frame { transform: translateY(8px) rotate(-4deg) scaleY(.78); }
.thm-indicator[data-state="searching"] .thm-arm { opacity: .48; transform: rotate(30deg); }
.thm-indicator[data-state="searching"] .thm-halo { opacity: 0; }
.thm-indicator[data-state="searching"] .thm-sensor { opacity: 1; transform: translateY(-7px); animation: thm-gimbal calc(var(--thm-loop) * .75) ease-in-out infinite; }
.thm-indicator[data-state="searching"] .thm-beam { opacity: 1; animation: thm-scan var(--thm-loop) ease-in-out infinite; }
.thm-indicator[data-state="reading"] .thm-frame { transform: translateY(3px) rotate(3deg); }
.thm-indicator[data-state="reading"] .thm-arm.left { transform: rotate(-29deg) translate(2px, 3px); }
.thm-indicator[data-state="reading"] .thm-arm.right { transform: rotate(29deg) translate(-2px, 3px); }
.thm-indicator[data-state="reading"] .thm-plate { opacity: 1; transform: translateY(1px); }
.thm-indicator[data-state="reading"] .thm-line { animation: thm-read var(--thm-loop) steps(1, end) infinite; }
.thm-indicator[data-state="reading"] .thm-line.two { animation-delay: calc(var(--thm-loop) * -.18); }
.thm-indicator[data-state="reading"] .thm-line.three { animation-delay: calc(var(--thm-loop) * -.36); }
.thm-indicator * { animation-play-state: var(--thm-play) !important; }
@keyframes thm-think { 0%,100% { transform: translateY(0) rotate(0deg); } 32% { transform: translateY(-2px) rotate(-3deg); } 67% { transform: translateY(1px) rotate(2deg); } }
@keyframes thm-orbit { to { transform: rotate(360deg); } }
@keyframes thm-pulse { 0%,100% { transform: scale(1); } 43% { transform: scale(1.22); } 56% { transform: scale(.94); } }
@keyframes thm-drive { 0%,100% { transform: translateY(5px) translateX(-1px); } 50% { transform: translateY(7px) translateX(2px); } }
@keyframes thm-wheel { to { stroke-dashoffset: -21; } }
@keyframes thm-power { 0%,100% { opacity: .62; } 50% { opacity: 1; } }
@keyframes thm-listen { 0%,100% { transform: translateY(-2px); } 45% { transform: translateY(-5px); } }
@keyframes thm-wave { 0% { transform: scale(.35); opacity: .7; } 72%,100% { transform: scale(1.32); opacity: 0; } }
@keyframes thm-gimbal { 0%,100% { transform: translate(-5px,-7px) rotate(-11deg); } 50% { transform: translate(5px,-7px) rotate(11deg); } }
@keyframes thm-scan { 0%,100% { transform: rotate(-30deg); opacity: .1; } 16%,78% { opacity: .6; } 50% { transform: rotate(30deg); opacity: .85; } }
@keyframes thm-read { 0%,100% { transform: translateY(0); opacity: .3; } 35%,65% { transform: translateY(2px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .thm-indicator *, .thm-indicator *::before, .thm-indicator *::after { animation: none !important; transition: none !important; } .thm-indicator[data-state="executing"] .thm-rover, .thm-indicator[data-state="listening"] .thm-sensor, .thm-indicator[data-state="searching"] .thm-sensor, .thm-indicator[data-state="searching"] .thm-beam, .thm-indicator[data-state="reading"] .thm-plate { opacity: 1; } }
`;

export function useMechStyles(): void {
  useInsertionEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const node = document.createElement("style");
    node.id = STYLE_ID;
    node.textContent = styles;
    document.head.append(node);
  }, []);
}
