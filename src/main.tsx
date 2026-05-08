import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// PASTE YOUR GOOGLE WEB APP URL HERE
const APPS_SCRIPT_URL = 'YOUR_URL_HERE';

const STORAGE_KEY = 'inverted-log-v2';
const FU_TO_KG = 0.453592;

const EXERCISES = [
  "Barbell Bench Press", "Barbell Bent Over Row", "Barbell Conventional Deadlift",
  "Barbell Floor Press", "Barbell Front Loaded Reverse Lunge", "Barbell Front Squat", 
  "Barbell Hack Deadlift", "Barbell High Bar Back Squat", "Barbell Incline Press", 
  "Barbell Low Bar Back Squat", "Barbell Pause Bench Press", "Barbell Pendlay Row", 
  "Barbell Push Press", "Barbell Sumo Deadlift", "Behind-the-Neck Lat Pulldown",
  "Behind-the-Neck Press", "Cable Lat Pulldown", "Cable Single Arm Lat Pulldown",
  "Conventional Block Pull", "Conventional Pause Deadlift", "Dumbbell Bulgarian Split Squat", 
  "Dumbbell Deficit Bulgarian Split Squat", "Dumbbell Incline Press", "Dumbbell Reset Row", 
  "Dumbbell Row", "Dumbbell Seated Overhead Press", "Military Press", 
  "Muscle Snatch", "T-Bar Chest Supported Row", "T-Bar Row", "Zercher Squat"
];

const toKg = (fu) => (parseFloat(fu || 0) * FU_TO_KG).toFixed(1);

const App = () => {
  const [workouts, setWorkouts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState('LOG');
  const [syncing, setSyncing] = useState(false);
  const [prAlert, setPrAlert] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  }, [workouts]);

  const pushToCloud = async () => {
    if (!APPS_SCRIPT_URL.startsWith('http')) return alert("Set APPS_SCRIPT_URL first.");
    setSyncing(true);
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ workouts })
      });
      alert("Sent to Sheet!");
    } catch (e) { alert("Sync failed."); }
    setSyncing(false);
  };

  const pullFromCloud = async () => {
    if (!APPS_SCRIPT_URL.startsWith('http')) return alert("Set APPS_SCRIPT_URL first.");
    setSyncing(true);
    try {
      const res = await fetch(APPS_SCRIPT_URL);
      const data = await res.json();
      if (data.workouts) {
        setWorkouts(data.workouts);
        alert("Pulled from Sheet!");
      }
    } catch (e) { alert("Fetch failed."); }
    setSyncing(false);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.workouts) {
          setWorkouts(data.workouts);
          alert("Import Successful!");
        }
      } catch (err) { alert("Invalid JSON."); }
    };
    reader.readAsText(file);
  };

  const allEntries = useMemo(() => workouts.flatMap(w => w.entries.map(e => ({ ...e, date: w.date, workoutId: w.id }))), [workouts]);

  const getPRs = useMemo(() => {
    const prs = {};
    allEntries.forEach(e => {
      const max = Math.max(...e.sets.map(s => parseFloat(s.weight) || 0));
      if (!prs[e.exercise] || max > prs[e.exercise]) prs[e.exercise] = max;
    });
    return prs;
  }, [allEntries]);

  const addEntry = (entry) => {
    const today = new Date().toISOString().split('T')[0];
    const oldPR = getPRs[entry.exercise] || 0;
    const newMax = Math.max(...entry.sets.map(s => parseFloat(s.weight) || 0));
    let updated;
    const existingIdx = workouts.findIndex(w => w.date === today);
    if (existingIdx > -1) {
      updated = [...workouts];
      updated[existingIdx].entries.push(entry);
    } else {
      updated = [{ id: Date.now(), date: today, entries: [entry] }, ...workouts];
    }
    setWorkouts(updated);
    if (newMax > oldPR && oldPR > 0) setPrAlert(newMax);
  };

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', fontFamily: "'Barlow Condensed', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;700&display=swap');
        h1, h2, h3 { font-family: 'Bebas Neue', cursive; text-transform: uppercase; margin: 0; }
        button, .file-label { cursor: pointer; font-family: 'Bebas Neue', cursive; border: none; }
        input, select, textarea { background: #111; color: #fff; border: 1px solid #333; padding: 10px; font-family: inherit; }
      `}</style>

      <nav style={{ display: 'flex', background: '#080808', borderBottom: '1px solid #222' }}>
        {['LOG', 'HIST', 'PRs'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: '15px', background: 'none', color: activeTab === t ? '#fff' : '#444', fontSize: '1.2rem', borderBottom: activeTab === t ? '2px solid #fff' : 'none' }}>{t}</button>
        ))}
      </nav>

      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        {activeTab === 'LOG' && (
          <div>
            <LogTab onSave={addEntry} prs={getPRs} todayWorkout={workouts.find(w => w.date === new Date().toISOString().split('T')[0])} />
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button onClick={pushToCloud} disabled={syncing} style={{ flex: 1, padding: '12px', background: '#111', color: '#0f0', border: '1px solid #0f0' }}>{syncing ? '...' : '↑ PUSH TO SHEET'}</button>
              <button onClick={pullFromCloud} disabled={syncing} style={{ flex: 1, padding: '12px', background: '#111', color: '#0af', border: '1px solid #0af' }}>{syncing ? '...' : '↓ PULL FROM SHEET'}</button>
            </div>
            <div style={{ marginTop: '30px', borderTop: '1px dashed #222', paddingTop: '20px' }}>
              <input type="file" id="f-up" style={{ display: 'none' }} onChange={handleImport} />
              <label htmlFor="f-up" className="file-label" style={{ display: 'block', background: '#111', padding: '10px', textAlign: 'center', border: '1px solid #333' }}>IMPORT WORKOUTS.JSON</label>
            </div>
          </div>
        )}
        {activeTab === 'HIST' && <HistTab workouts={workouts} prs={getPRs} setWorkouts={setWorkouts} />}
        {activeTab === 'PRs' && <PrsTab entries={allEntries} prs={getPRs} />}
      </div>

      {prAlert && (
        <div onClick={() => setPrAlert(null)} style={{ position: 'fixed', inset: 0, background: '#fff', color: '#000', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{ fontSize: '12vw' }}>NEW PERSONAL RECORD</h1>
          <div style={{ fontSize: '15vw', fontWeight: 'bold' }}>{prAlert} FU</div>
        </div>
      )}
    </div>
  );
};

const LogTab = ({ onSave, prs, todayWorkout }) => {
  const [ex, setEx] = useState(EXERCISES[0]);
  const [sets, setSets] = useState([{ reps: '', weight: '' }]);
  const [note, setNote] = useState('');

  const handleAutoFill = () => {
    let w = [];
    if (ex.includes('Deadlift') || ex.includes('Squat')) w = [45, 135, 225, 315, 405];
    else if (ex.includes('Bench Press')) w = [45, 95, 135, 185, 225, 255, 275, 295, 315];
    if (w.length) setSets(w.map(v => ({ reps: '1', weight: v.toString() })));
  };

  return (
    <div>
      <h2 style={{ fontSize: '2rem', marginBottom: '20px' }}>LOG SESSION</h2>
      <select value={ex} onChange={e => setEx(e.target.value)} style={{ width: '100%', marginBottom: '10px' }}>
        {EXERCISES.map(name => <option key={name} value={name}>{name} (PR: {prs[name] || '-'})</option>)}
      </select>

      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
        <button onClick={handleAutoFill} style={{ flex: 1, background: '#222', color: '#fff', padding: '10px' }}>WARMUP</button>
        <button onClick={() => { const n = [...sets]; n[0].reps = (parseInt(n[0].reps || 0) * 3).toString(); setSets(n); }} style={{ flex: 1, background: '#222', color: '#fff' }}>×3</button>
        <button onClick={() => setSets([...sets, { ...sets[sets.length - 1] }])} style={{ flex: 1, background: '#222', color: '#fff' }}>COPY</button>
        <button onClick={() => setSets([...sets, { reps: '', weight: '' }])} style={{ flex: 1, background: '#222', color: '#fff' }}>+SET</button>
      </div>

      {sets.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ width: '20px', color: '#444' }}>{i + 1}</span>
          <input placeholder="REPS" value={s.reps} onChange={e => { const n = [...sets]; n[i].reps = e.target.value; setSets(n); }} style={{ width: '60px' }} />
          <div style={{ flex: 1 }}>
            <input placeholder="WEIGHT" value={s.weight} onChange={e => { const n = [...sets]; n[i].weight = e.target.value; setSets(n); }} style={{ width: '100%' }} />
            <div style={{ fontSize: '0.7rem', color: '#555' }}>{toKg(s.weight)} KG</div>
          </div>
          <button onClick={() => setSets(sets.filter((_, idx) => idx !== i))} style={{ color: '#822', background: 'none' }}>×</button>
        </div>
      ))}

      <textarea placeholder="Note..." value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%', height: '60px', marginTop: '10px' }} />
      <button onClick={() => { onSave({ exercise: ex, sets, note }); setSets([{ reps: '', weight: '' }]); setNote(''); }} style={{ width: '100%', background: '#fff', color: '#000', padding: '15px', marginTop: '15px', fontSize: '1.2rem' }}>LOG SETS</button>
    </div>
  );
};

const HistTab = ({ workouts, prs, setWorkouts }) => (
  <div>
    <h2 style={{ fontSize: '2rem', marginBottom: '20px' }}>HISTORY</h2>
    {[...workouts].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(w => (
      <div key={w.id} style={{ marginBottom: '20px', border: '1px solid #222', padding: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', marginBottom: '10px' }}>
          <h3>{w.date}</h3>
          <button onClick={() => setWorkouts(workouts.filter(x => x.id !== w.id))} style={{ color: '#522', background: 'none' }}>DELETE</button>
        </div>
        {w.entries.map((e, i) => (
          <div key={i} style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold' }}>{e.exercise}</div>
            {e.sets.map((s, si) => (
              <div key={si} style={{ color: '#888', fontSize: '0.9rem' }}>{s.reps} × {s.weight} FU ({toKg(s.weight)} KG) — {((parseFloat(s.weight) / (prs[e.exercise] || 1)) * 100).toFixed(0)}% PR</div>
            ))}
          </div>
        ))}
      </div>
    ))}
  </div>
);

const PrsTab = ({ entries, prs }) => (
  <div>
    <h2 style={{ fontSize: '2rem', marginBottom: '20px' }}>PERSONAL RECORDS</h2>
    {EXERCISES.filter(ex => prs[ex]).map(ex => (
      <div key={ex} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 0', borderBottom: '1px solid #111' }}>
        <div>
          <div style={{ fontSize: '1.2rem' }}>{ex}</div>
          <div style={{ color: '#888' }}>{prs[ex]} FU / {toKg(prs[ex])} KG</div>
        </div>
      </div>
    ))}
  </div>
);

const root = createRoot(document.getElementById('root'));
root.render(<App />);