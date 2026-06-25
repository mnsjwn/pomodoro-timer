import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  Coffee,
  Settings,
  Minus,
  Plus,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'pomodoro_settings_v1';
const DEFAULT_WORK = 25; // 분
const DEFAULT_BREAK = 5; // 분

// 오늘 날짜(YYYY-MM-DD) — 세션 카운터를 하루 단위로 초기화하기 위해 사용
const todayStr = () => new Date().toISOString().slice(0, 10);

// 저장된 설정/세션 불러오기 (없거나 손상되면 기본값)
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const data = JSON.parse(raw);
    const sameDay = data.date === todayStr();
    return {
      workMin: clampMin(data.workMin ?? DEFAULT_WORK),
      breakMin: clampMin(data.breakMin ?? DEFAULT_BREAK),
      sessions: sameDay ? data.sessions ?? 0 : 0,
    };
  } catch {
    return { workMin: DEFAULT_WORK, breakMin: DEFAULT_BREAK, sessions: 0 };
  }
}

// 1~120분 범위로 제한
const clampMin = (n) => Math.max(1, Math.min(120, Math.round(Number(n) || 0)));

export default function PomodoroTimer() {
  const initial = loadState();

  const [workMin, setWorkMin] = useState(initial.workMin);
  const [breakMin, setBreakMin] = useState(initial.breakMin);
  const [sessions, setSessions] = useState(initial.sessions);

  const [timeLeft, setTimeLeft] = useState(initial.workMin * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // 종료 시점에 짧은 알림음 재생 (라이브러리 없이 Web Audio API 사용)
  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      /* 오디오 미지원 환경은 조용히 무시 */
    }
  }, []);

  // 카운트다운 + 자동 모드 전환
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      playChime();
      if (!isBreak) {
        setSessions((prev) => prev + 1);
        setTimeLeft(breakMin * 60);
        setIsBreak(true);
      } else {
        setTimeLeft(workMin * 60);
        setIsBreak(false);
      }
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isBreak, workMin, breakMin, playChime]);

  // 설정/세션 영구 저장
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ workMin, breakMin, sessions, date: todayStr() })
    );
  }, [workMin, breakMin, sessions]);

  // 탭 제목에 남은 시간 표시
  useEffect(() => {
    document.title = `${formatTime(timeLeft)} · ${isBreak ? '휴식' : '집중'}`;
  }, [timeLeft, isBreak]);

  const toggleTimer = () => setIsActive((a) => !a);

  const resetTimer = () => {
    setIsActive(false);
    setIsBreak(false);
    setTimeLeft(workMin * 60);
  };

  // 설정에서 시간을 바꾸면, 타이머가 멈춰있을 때 현재 모드 시간에 즉시 반영
  const applyWork = (min) => {
    const v = clampMin(min);
    setWorkMin(v);
    if (!isActive && !isBreak) setTimeLeft(v * 60);
  };
  const applyBreak = (min) => {
    const v = clampMin(min);
    setBreakMin(v);
    if (!isActive && isBreak) setTimeLeft(v * 60);
  };

  // 상태별 파스텔 톤
  const containerBg = isBreak ? 'bg-sky-50' : 'bg-rose-50';
  const textColor = isBreak ? 'text-sky-400' : 'text-rose-400';
  const buttonBg = isBreak
    ? 'bg-sky-200 hover:bg-sky-300'
    : 'bg-rose-200 hover:bg-rose-300';

  const totalSec = (isBreak ? breakMin : workMin) * 60;
  const progress = totalSec > 0 ? 1 - timeLeft / totalSec : 0;

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f4f0] text-gray-700 font-sans p-4">
      <div
        className={`relative p-10 rounded-3xl shadow-[8px_8px_16px_#e4e2dd,-8px_-8px_16px_#ffffff] w-80 text-center transition-colors duration-500 ${containerBg}`}
      >
        {/* 설정 버튼 */}
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="시간 설정"
        >
          {showSettings ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
        </button>

        <div className="flex justify-center mb-4">
          {isBreak ? (
            <Coffee className={`w-8 h-8 ${textColor}`} />
          ) : (
            <BookOpen className={`w-8 h-8 ${textColor}`} />
          )}
        </div>

        <h2 className="text-xl font-semibold mb-6 tracking-wide text-gray-600">
          {isBreak ? '휴식 시간' : '집중 시간'}
        </h2>

        {/* 원형 진행 링 + 남은 시간 */}
        <div className="relative w-48 h-48 mx-auto mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="5"
              className="stroke-gray-200/70"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              className={`${isBreak ? 'stroke-sky-300' : 'stroke-rose-300'} transition-all duration-500`}
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
            />
          </svg>
          <div
            className={`absolute inset-0 flex items-center justify-center text-5xl font-bold tracking-wider ${textColor}`}
          >
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="flex justify-center gap-6 mb-8">
          <button
            onClick={toggleTimer}
            className={`p-4 rounded-full shadow-sm transition-all ${buttonBg} text-gray-700`}
            aria-label={isActive ? '일시정지' : '시작'}
          >
            {isActive ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </button>
          <button
            onClick={resetTimer}
            className="p-4 rounded-full bg-stone-200 hover:bg-stone-300 shadow-sm transition-all text-gray-600"
            aria-label="리셋"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>

        <div className="pt-4 border-t border-gray-200/50">
          <p className="text-sm text-gray-500 font-medium">
            오늘 완료한 집중 세션:{' '}
            <span className="font-bold text-gray-700">{sessions}</span>번
          </p>
        </div>

        {/* 설정 패널 */}
        {showSettings && (
          <div className="absolute inset-0 rounded-3xl bg-[#f5f4f0]/95 backdrop-blur-sm p-8 flex flex-col justify-center gap-6">
            <h3 className="text-lg font-semibold text-gray-600">시간 설정</h3>

            <Stepper
              label="집중 시간"
              unit="분"
              value={workMin}
              accent="rose"
              onChange={applyWork}
              disabled={isActive}
            />
            <Stepper
              label="휴식 시간"
              unit="분"
              value={breakMin}
              accent="sky"
              onChange={applyBreak}
              disabled={isActive}
            />

            <p className="text-xs text-gray-400 leading-relaxed">
              {isActive
                ? '타이머를 멈춘 뒤 시간을 변경할 수 있어요.'
                : '1~120분 사이로 조절할 수 있어요. 과목·컨디션에 맞게 설정해 보세요.'}
            </p>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-2 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-gray-600 text-sm font-medium transition-colors"
            >
              완료
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 숫자 입력 + 증감 버튼
function Stepper({ label, unit, value, onChange, accent, disabled }) {
  const ring =
    accent === 'sky'
      ? 'focus:ring-sky-200 text-sky-500'
      : 'focus:ring-rose-200 text-rose-500';
  const btn =
    accent === 'sky'
      ? 'bg-sky-100 hover:bg-sky-200 text-sky-600'
      : 'bg-rose-100 hover:bg-rose-200 text-rose-600';

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onChange(value - 1)}
          className={`p-2 rounded-full shadow-sm transition-colors ${btn}`}
          aria-label={`${label} 줄이기`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex items-baseline gap-1 w-24 justify-center">
          <input
            type="number"
            min="1"
            max="120"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`w-14 bg-transparent text-center text-2xl font-bold outline-none rounded-lg focus:ring-2 ${ring}`}
          />
          <span className="text-sm text-gray-400">{unit}</span>
        </div>
        <button
          onClick={() => onChange(value + 1)}
          className={`p-2 rounded-full shadow-sm transition-colors ${btn}`}
          aria-label={`${label} 늘리기`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
