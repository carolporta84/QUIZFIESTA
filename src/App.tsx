import { useEffect, useMemo, useState } from 'react'
import { supabase, configured } from './supabase'
import { Trophy, Users, Plus, ArrowRight, Crown, Timer, CheckCircle2, Sparkles, Play, RotateCcw } from 'lucide-react'

type Room = { id: string; code: string; status: string; current_question: number; question_started_at: string | null; question_seconds: number }
type Player = { id: string; room_id: string; name: string; avatar: string; score: number; joined_at: string }
type Question = { id: string; room_id: string; position: number; prompt: string; options: string[]; correct_index: number; seconds: number }
type Answer = { id: string; player_id: string; question_id: string; option_index: number; answered_at: string; is_correct: boolean; points: number }
type DraftQuestion = { prompt: string; options: string[]; correct_index: number; seconds: number }
type SavedQuiz = { id: string; title: string; questions: DraftQuestion[] }

const avatars = ['🦊','🐼','🐸','🦄','🐯','🐙','🐵','🐧','🐲','🐨','🦁','🐰']
const demoQuestions = [
  { prompt: '¿Cuál es el planeta más grande del sistema solar?', options: ['Marte','Júpiter','Venus','Saturno'], correct_index: 1, seconds: 20 },
  { prompt: '¿Cuántos lados tiene un hexágono?', options: ['5','6','7','8'], correct_index: 1, seconds: 15 },
  { prompt: '¿Qué animal es conocido como el rey de la selva?', options: ['Tigre','Elefante','León','Guepardo'], correct_index: 2, seconds: 15 },
  { prompt: '¿Cuál es la capital de Italia?', options: ['Atenas','Roma','Lisboa','París'], correct_index: 1, seconds: 15 }
]
const colors = ['#7657ff','#ff9d42','#17b89b','#ee5a91']

function App() {
  const params = new URLSearchParams(location.search)
  const initialCode = params.get('sala') || ''
  const [mode, setMode] = useState<'home'|'host'|'player'|'editor'>(initialCode ? 'player' : 'home')
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>(() => {
    try { return JSON.parse(localStorage.getItem('quizfiesta-quizzes') || '[]') as SavedQuiz[] } catch { return [] }
  })
  const [quizTitle, setQuizTitle] = useState('Mi primer concurso')
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([])
  const [draftPrompt, setDraftPrompt] = useState('')
  const [draftOptions, setDraftOptions] = useState(['', '', '', ''])
  const [draftCorrect, setDraftCorrect] = useState(0)
  const [draftSeconds, setDraftSeconds] = useState(20)
  const [selectedQuiz, setSelectedQuiz] = useState<SavedQuiz | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [code, setCode] = useState(initialCode.toUpperCase())
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('🦊')
  const [me, setMe] = useState<Player | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)

    const currentQuestion = questions.find(q => q.position === room?.current_question) || null
  const myAnswer = answers.find(a => a.player_id === me?.id && a.question_id === currentQuestion?.id)
  const ranked = useMemo(() => [...players].sort((a,b) => b.score-a.score || a.joined_at.localeCompare(b.joined_at)), [players])
  const answeredCount = currentQuestion ? answers.filter(a => a.question_id === currentQuestion.id).length : 0

  async function refreshRoom(roomId: string) {
    if (!supabase) return
    const [{ data: r }, { data: p }, { data: q }, { data: a }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', roomId).single(),
      supabase.from('players').select('*').eq('room_id', roomId).order('joined_at'),
      supabase.from('questions').select('*').eq('room_id', roomId).order('position'),
      supabase.from('answers').select('*').eq('room_id', roomId)
    ])
    if (r) setRoom(r as Room)
    if (p) setPlayers(p as Player[])
    if (q) setQuestions(q as Question[])
    if (a) setAnswers(a as Answer[])
  }

  useEffect(() => {
    if (!room || !supabase) return
    refreshRoom(room.id)
    const channel = supabase.channel(`room-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => refreshRoom(room.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, () => refreshRoom(room.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions', filter: `room_id=eq.${room.id}` }, () => refreshRoom(room.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `room_id=eq.${room.id}` }, () => refreshRoom(room.id))
      .subscribe()
    return () => { supabase?.removeChannel(channel) }
  }, [room?.id])

  useEffect(() => {
    if (!room || room.status !== 'question' || !room.question_started_at) { setSecondsLeft(0); return }
    const update = () => {
      const elapsed = (Date.now() - new Date(room.question_started_at!).getTime()) / 1000
      setSecondsLeft(Math.max(0, Math.ceil((room.question_seconds || currentQuestion?.seconds || 20) - elapsed)))
    }
    update()
    const t = window.setInterval(update, 250)
    return () => window.clearInterval(t)
  }, [room?.status, room?.question_started_at, room?.question_seconds, currentQuestion?.id])

  function persistQuizzes(next: SavedQuiz[]) {
    setSavedQuizzes(next)
    localStorage.setItem('quizfiesta-quizzes', JSON.stringify(next))
  }

  function addDraftQuestion() {
    if (!draftPrompt.trim() || draftOptions.some(o => !o.trim())) {
      setNotice('Completa la pregunta y sus cuatro respuestas.')
      return
    }
    setDraftQuestions(prev => [...prev, { prompt: draftPrompt.trim(), options: draftOptions.map(o => o.trim()), correct_index: draftCorrect, seconds: draftSeconds }])
    setDraftPrompt('')
    setDraftOptions(['', '', '', ''])
    setDraftCorrect(0)
    setDraftSeconds(20)
    setNotice('')
  }

  function saveQuiz() {
    if (!quizTitle.trim() || draftQuestions.length === 0) {
      setNotice('Pon un título y añade al menos una pregunta.')
      return
    }
    const quiz: SavedQuiz = { id: crypto.randomUUID(), title: quizTitle.trim(), questions: draftQuestions }
    persistQuizzes([...savedQuizzes, quiz])
    setSelectedQuiz(quiz)
    setNotice('¡Concurso guardado en este dispositivo!')
  }

  function deleteQuiz(id: string) {
    persistQuizzes(savedQuizzes.filter(q => q.id !== id))
    if (selectedQuiz?.id === id) setSelectedQuiz(null)
  }

  async function createRoom() {
    if (!supabase) return
    setBusy(true); setNotice('')
    const roomCode = Math.random().toString(36).slice(2, 6).toUpperCase()
    const { data, error } = await supabase.from('rooms').insert({ code: roomCode, status: 'lobby', current_question: 0, question_seconds: 20 }).select().single()
    if (error || !data) { setNotice(error?.message || 'No se pudo crear la sala'); setBusy(false); return }
    const sourceQuestions = selectedQuiz?.questions?.length ? selectedQuiz.questions : demoQuestions
    const qs = sourceQuestions.map((q,i) => ({ ...q, room_id: data.id, position: i + 1 }))
    const { error: qError } = await supabase.from('questions').insert(qs)
    if (qError) setNotice(qError.message)
    setRoom(data as Room); setMode('host'); setBusy(false)
  }

  async function joinRoom() {
    if (!supabase) return
    if (!name.trim() || !code.trim()) { setNotice('Escribe tu nombre y el código de sala'); return }
    setBusy(true); setNotice('')
    const { data: r, error: rError } = await supabase.from('rooms').select('*').eq('code', code.trim().toUpperCase()).single()
    if (rError || !r) { setNotice('No encontramos esa sala. Comprueba el código.'); setBusy(false); return }
    const { data: p, error } = await supabase.from('players').insert({ room_id: r.id, name: name.trim().slice(0,20), avatar }).select().single()
    if (error || !p) { setNotice(error?.message || 'No se pudo entrar'); setBusy(false); return }
    setRoom(r as Room); setMe(p as Player); setMode('player'); setBusy(false)
    history.replaceState({}, '', `?sala=${r.code}`)
  }

  async function startQuestion() {
  if (!room || !supabase) return

  const question = questions.find(q => q.position === room.current_question) ||
    (room.current_question === 0 ? questions.find(q => q.position === 1) : null)

  if (!question) {
    setNotice('No se encuentra la primera pregunta. Comprueba que hay preguntas preparadas.')
    return
  }

  const { error } = await supabase.from('rooms').update({
    status: 'question',
    current_question: question.position,
    question_started_at: new Date().toISOString(),
    question_seconds: question.seconds
  }).eq('id', room.id)

  if (error) setNotice(error.message)
}

  async function submitAnswer(optionIndex: number) {
    if (!room || !me || !currentQuestion || !supabase || myAnswer || room.status !== 'question' || secondsLeft <= 0) return
    setSelected(optionIndex)
    const { data, error } = await supabase.from('answers').insert({
      room_id: room.id, player_id: me.id, question_id: currentQuestion.id,
      option_index: optionIndex, answered_at: new Date().toISOString(),
      is_correct: false, points: 0
    }).select().single()
    if (error) setNotice(error.message)
    else if (data) setAnswers(prev => [...prev, data as Answer])
  }

  async function closeQuestion() {
    if (!room || !currentQuestion || !supabase) return
    const { data: submitted } = await supabase.from('answers').select('*').eq('room_id', room.id).eq('question_id', currentQuestion.id)
    const start = room.question_started_at ? new Date(room.question_started_at).getTime() : Date.now()
    for (const a of (submitted || []) as Answer[]) {
      const elapsed = (new Date(a.answered_at).getTime() - start) / 1000
      const correct = a.option_index === currentQuestion.correct_index
      const speedBonus = correct ? Math.max(0, Math.round(500 * (1 - elapsed / currentQuestion.seconds))) : 0
      const points = correct ? 500 + speedBonus : 0
      await supabase.from('answers').update({ is_correct: correct, points }).eq('id', a.id)
      if (correct) {
        const player = players.find(p => p.id === a.player_id)
        if (player) await supabase.from('players').update({ score: player.score + points }).eq('id', player.id)
      }
    }
    await supabase.from('rooms').update({ status: 'results' }).eq('id', room.id)
    await refreshRoom(room.id)
  }

  async function nextQuestion() {
    if (!room || !supabase) return
    const next = room.current_question + 1
    if (next > questions.length) await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
    else await supabase.from('rooms').update({ status: 'lobby', current_question: next, question_started_at: null }).eq('id', room.id)
  }

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}?sala=${room?.code}`
    await navigator.clipboard?.writeText(url)
    setNotice('¡Enlace copiado! Compártelo con los jugadores.')
  }

  if (!configured) return <div className="setup"><div className="brand">🎉 QuizFiesta</div><div className="setup-card"><h1>¡Vamos a preparar la fiesta!</h1><p>La aplicación ya tiene su interfaz y lógica de juego. Para conectar varios móviles, configura el proyecto gratuito de Supabase siguiendo el archivo <b>README.md</b> incluido.</p><div className="setup-step">1. Crea un proyecto en Supabase</div><div className="setup-step">2. Ejecuta <b>supabase/schema.sql</b> en el SQL Editor</div><div className="setup-step">3. Copia la URL y la clave pública en <b>.env</b></div><div className="setup-step">4. Ejecuta <b>npm install</b> y <b>npm run dev</b></div><p className="muted">No introduzcas nunca la clave service_role en esta aplicación.</p></div></div>

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">✦</span> QuizFiesta</div><span className="tag">¡Que empiece el juego!</span></header>
    {mode === 'home' && <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> EL CONCURSO MULTIJUGADOR</div><h1>¿Preparados?<br/><span>¡A jugar!</span></h1><p>Crea una sala, reúne a tus amigos y descubre quién tiene la mente más rápida.</p>
        <div className="home-actions"><button className="primary" onClick={createRoom} disabled={busy}><Plus size={18}/> Crear partida</button><button className="secondary" onClick={() => setMode('player')}>Unirme a una sala <ArrowRight size={17}/></button>
          <button className="secondary" onClick={() => { setDraftQuestions([]); setNotice(''); setMode('editor') }}>Crear concurso <Sparkles size={17}/></button></div>
      </div><div className="hero-art"><div className="burst">QUIZ!</div><div className="mascot">🦊</div><div className="float f1">⭐</div><div className="float f2">🎯</div><div className="float f3">🏆</div></div>
    </section>}
    {mode === 'editor' && <section className="game-panel editor-panel">
      <div className="eyebrow">CREADOR DE CONCURSOS</div>
      <h1>Diseña tu propio quiz ✨</h1>
      <p className="muted">Prepara las preguntas y guarda tu concurso para usarlo al crear una sala.</p>
      <label className="field-label">Nombre del concurso</label>
      <input className="editor-input" value={quizTitle} onChange={e=>setQuizTitle(e.target.value)} placeholder="Ej. Noche de cine"/>
      <div className="editor-divider"/>
      <h2>Nueva pregunta</h2>
      <label className="field-label">Escribe la pregunta</label>
      <textarea className="editor-input" rows={2} value={draftPrompt} onChange={e=>setDraftPrompt(e.target.value)} placeholder="¿Cuál es la capital de Francia?"/>
      <label className="field-label">Respuestas (marca la correcta)</label>
      <div className="draft-options">{draftOptions.map((o,i)=><div className="draft-option" key={i}><button className={`correct-pick ${draftCorrect===i?'is-correct':''}`} onClick={()=>setDraftCorrect(i)} title="Marcar como correcta">{['A','B','C','D'][i]}</button><input className="editor-input" value={o} onChange={e=>setDraftOptions(prev=>prev.map((v,j)=>j===i?e.target.value:v))} placeholder={`Respuesta ${i+1}`}/></div>)}</div>
      <label className="field-label">Tiempo para responder</label>
      <div className="time-picks">{[10,15,20,30,45].map(t=><button key={t} className={`time-pick ${draftSeconds===t?'active':''}`} onClick={()=>setDraftSeconds(t)}>{t}s</button>)}</div>
      <button className="secondary full" onClick={addDraftQuestion}><Plus size={17}/> Añadir pregunta</button>
      {draftQuestions.length>0 && <><h2>Preguntas añadidas ({draftQuestions.length})</h2><div className="draft-list">{draftQuestions.map((q,i)=><div className="draft-item" key={i}><b>{i+1}. {q.prompt}</b><span>Correcta: {q.options[q.correct_index]} · {q.seconds} segundos</span><button onClick={()=>setDraftQuestions(prev=>prev.filter((_,j)=>j!==i))}>Eliminar</button></div>)}</div></>}
      <button className="primary full" onClick={saveQuiz}><CheckCircle2 size={18}/> Guardar concurso</button>
      {notice && <p className="notice">{notice}</p>}
      {savedQuizzes.length>0 && <><div className="editor-divider"/><h2>Mis concursos guardados</h2><div className="draft-list">{savedQuizzes.map(q=><div className={`saved-quiz ${selectedQuiz?.id===q.id?'selected-quiz':''}`} key={q.id}><button className="saved-quiz-main" onClick={()=>setSelectedQuiz(q)}><b>{q.title}</b><span>{q.questions.length} preguntas {selectedQuiz?.id===q.id?'· Seleccionado':''}</span></button><button className="delete-quiz" onClick={()=>deleteQuiz(q.id)}>Borrar</button></div>)}</div></>}
      <button className="text-button" onClick={()=>setMode('home')}>Volver al inicio</button>
    </section>}
    {mode === 'player' && !me && <section className="join-card"><div className="eyebrow">ENTRA EN EL CONCURSO</div><h1>¡Busca tu sitio!</h1><label>Código de la sala</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Ej. A7K2" maxLength={4}/><label>Tu nombre</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="¿Cómo te llamas?" maxLength={20}/><label>Elige tu avatar</label><div className="avatar-grid">{avatars.map(a=><button key={a} className={`avatar ${avatar===a?'chosen':''}`} onClick={()=>setAvatar(a)}>{a}</button>)}</div><button className="primary full" onClick={joinRoom} disabled={busy}>Entrar a jugar <ArrowRight size={18}/></button><button className="text-button" onClick={()=>setMode('home')}>Volver</button></section>}
    {room && mode === 'host' && <section className="game-panel">
      <div className="panel-head"><div><div className="eyebrow">PANEL DEL PRESENTADOR</div><h1>{room.status==='finished'?'¡Concurso terminado!':'Tu sala está lista'}</h1></div><div className="room-code"><small>CÓDIGO DE SALA</small><strong>{room.code}</strong><button onClick={copyLink}>Copiar enlace</button></div></div>
      {room.status==='lobby' && <><div className="stats"><div><Users/><strong>{players.length}</strong><span>Jugadores conectados</span></div><div><Trophy/><strong>{questions.length}</strong><span>Preguntas preparadas</span></div></div><h2>¡Ya pueden entrar!</h2><div className="player-chips">{players.map(p=><div className="player-chip" key={p.id}><span>{p.avatar}</span>{p.name}</div>)}{players.length===0&&<p className="muted">Esperando a los jugadores…</p>}</div>{room.current_question===0 ? <button className="primary full" onClick={startQuestion} disabled={players.length===0}><Play size={18}/> Comenzar concurso</button> : <button className="primary full" onClick={startQuestion}><Play size={18}/> Lanzar pregunta {room.current_question}</button>}</>}
      {room.status==='question' && currentQuestion && <><div className="question-meta"><span>Pregunta {currentQuestion.position} de {questions.length}</span><span className="timer"><Timer size={17}/> {secondsLeft}s</span></div><h2 className="question-title">{currentQuestion.prompt}</h2><div className="answer-grid">{currentQuestion.options.map((o,i)=><div className="answer-option" style={{background:colors[i]}} key={o}><b>{['A','B','C','D'][i]}</b>{o}</div>)}</div><p className="muted">{answeredCount} de {players.length} han respondido</p><button className="primary full" onClick={closeQuestion}>Cerrar pregunta y ver resultados</button></>}
      {room.status==='results' && currentQuestion && <><div className="result-banner"><CheckCircle2/><div><b>Respuesta correcta</b><span>{currentQuestion.options[currentQuestion.correct_index]}</span></div></div><h2>Clasificación actual</h2><Leaderboard players={ranked}/><button className="primary full" onClick={nextQuestion}>{room.current_question===questions.length?'Ver podio final':'Siguiente pregunta'} <ArrowRight size={18}/></button></>}
      {room.status==='finished' && <><div className="winner">🏆</div><h2 className="center">¡Tenemos ganador!</h2><Leaderboard players={ranked}/><button className="secondary full" onClick={()=>location.reload()}><RotateCcw size={17}/> Nueva partida</button></>}
      {notice && <p className="notice">{notice}</p>}
    </section>}
    {room && mode==='player' && me && <section className="game-panel player-view">
      <div className="player-welcome"><span className="big-avatar">{me.avatar}</span><div><small>JUGANDO COMO</small><h2>{me.name}</h2></div><div className="score-pill">⭐ {players.find(p=>p.id===me.id)?.score ?? me.score} pts</div></div>
      {room.status==='lobby' && <div className="waiting"><div className="waiting-icon">🎈</div><h1>¡Estás dentro!</h1><p>El presentador está preparando la siguiente pregunta. ¡Mucha suerte!</p><div className="pulse-dots">● ● ●</div></div>}
      {room.status==='question' && currentQuestion && <><div className="question-meta"><span>Pregunta {currentQuestion.position}</span><span className="timer"><Timer size={17}/> {secondsLeft}s</span></div><h1 className="question-title">{currentQuestion.prompt}</h1><div className="player-answers">{currentQuestion.options.map((o,i)=><button key={o} disabled={!!myAnswer || secondsLeft<=0} className={`player-answer c${i} ${selected===i?'selected':''}`} onClick={()=>submitAnswer(i)}><b>{['A','B','C','D'][i]}</b>{o}</button>)}</div>{myAnswer&&<div className="feedback">¡Respuesta enviada! Espera a que el presentador cierre la pregunta.</div>}</>}
      {room.status==='results' && currentQuestion && <><div className="waiting"><div className="waiting-icon">{answers.find(a=>a.player_id===me.id&&a.question_id===currentQuestion.id)?.is_correct?'🎉':'💪'}</div><h1>{answers.find(a=>a.player_id===me.id&&a.question_id===currentQuestion.id)?.is_correct?'¡Correcto!':'¡A por la siguiente!'}</h1><p>Has conseguido <b>{answers.find(a=>a.player_id===me.id&&a.question_id===currentQuestion.id)?.points||0} puntos</b>.</p></div><h2>Clasificación</h2><Leaderboard players={ranked}/></>}
      {room.status==='finished' && <><div className="winner">🏆</div><h1 className="center">¡Fin del concurso!</h1><Leaderboard players={ranked}/></>}
    </section>}
    {notice && mode==='player' && !me && <p className="notice">{notice}</p>}
    <footer>QuizFiesta · ¡La diversión está en jugar juntos!</footer>
  </main>
}

function Leaderboard({players}:{players:Player[]}) {
  return <div className="leaderboard">{players.map((p,i)=><div className={`rank-row ${i===0?'first':''}`} key={p.id}><span className="rank">{i===0?'👑':i+1}</span><span className="rank-avatar">{p.avatar}</span><b>{p.name}</b><strong>{p.score.toLocaleString('es-ES')} pts</strong></div>)}</div>
}
export default App
