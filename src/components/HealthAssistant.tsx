import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Trash2, Plus, FileText } from 'lucide-react';
import { EnvironmentalStationData } from '../types/environmental';
import { cloudRequest } from '../services/cloudStorage';

type DocumentItem = { documentId: string; name: string; status: string; confirmed: boolean };
type Message = { role: 'user' | 'assistant'; content: string; createdAt: string; sources?: string[]; evidence?: Array<{ document: string; page: number | null; text: string }> };
type Conversation = { conversationId: string; createdAt: string; updatedAt: string; messages: Message[]; lastMessage?: string; messageCount?: number };
type Reminder = { reminderId: string; title: string; dueAt: string; kind: string; clinicianConfirmed?: boolean };

const SUGGESTIONS = ['Summarize my selected report.', 'What does my report say about triggers?', 'Can I exercise outdoors today?', 'Summarize my symptoms from the last 7 days.'];

export function HealthAssistant({ stationData }: { stationData: EnvironmentalStationData | null }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderTitle, setReminderTitle] = useState(''); const [reminderDue, setReminderDue] = useState(''); const [reminderKind, setReminderKind] = useState('appointment'); const [clinicianConfirmed, setClinicianConfirmed] = useState(false);
  const [reminderNotice, setReminderNotice] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [includeHealth, setIncludeHealth] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  async function refresh() {
    const [docsResult, chatsResult] = await Promise.allSettled([cloudRequest('/documents'), cloudRequest('/assistant/conversations')]);
    if (chatsResult.status === 'fulfilled') {
      setConversations(chatsResult.value.data || []);
      setError(e => (e && /Assistant is setting up/i.test(e)) ? '' : e);
    }
    if (docsResult.status === 'fulfilled') {
      setDocuments(docsResult.value.data || []);
    }
    try { const r = await cloudRequest('/reminders'); setReminders(r.data || []); } catch { /* not yet deployed */ }
  }
  useEffect(() => { void refresh().catch(() => { /* errors surface on action */ }); }, []);

  async function openConversation(id: string) {
    setError(''); setBusy(true);
    try { const result = await cloudRequest('/assistant/conversations/item?id=' + encodeURIComponent(id)); setConversationId(id); setMessages(result.data.messages || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load this conversation.'); }
    finally { setBusy(false); }
  }
  function newConversation() { setConversationId(''); setMessages([]); setError(''); }
  async function clearConversation() {
    if (!conversationId) { newConversation(); return; }
    setBusy(true); setError('');
    try { await cloudRequest('/assistant/conversations/item?id=' + encodeURIComponent(conversationId), undefined, 'DELETE'); setConversations(c => c.filter(x => x.conversationId !== conversationId)); newConversation(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not clear this conversation.'); }
    finally { setBusy(false); }
  }
  async function addReminder(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setReminderNotice('');
    try { const result=await cloudRequest('/reminders',{title:reminderTitle,dueAt:new Date(reminderDue).toISOString(),kind:reminderKind,clinicianConfirmed});setReminders(current=>[...current,result.data].sort((a,b)=>a.dueAt.localeCompare(b.dueAt)));setReminderTitle('');setReminderDue('');setClinicianConfirmed(false);setReminderNotice('Reminder saved to your private account. This demo displays due reminders here; it does not send notifications.'); }
    catch(e) { setReminderNotice(e instanceof Error?e.message:'Could not save reminder.'); }
    finally { setBusy(false); }
  }
  async function deleteReminder(id: string) { setBusy(true);try{await cloudRequest('/reminders?id='+encodeURIComponent(id),undefined,'DELETE');setReminders(list=>list.filter(r=>r.reminderId!==id));}catch(e){setReminderNotice(e instanceof Error?e.message:'Could not delete reminder.');}finally{setBusy(false);} }
  async function send(text = draft) {
    const content = text.trim(); if (!content) return;
    if (/severe breathing|struggling to breathe|can't breathe|cannot breathe|unable to speak|blue lips|turning blue|confusion/i.test(content)) {
      requestVersion.current++; const now = new Date().toISOString(); setBusy(false); setMessages(current => [...current, { role: 'user', content, createdAt: now }, { role: 'assistant', content: 'Severe breathing difficulty, inability to speak normally, blue lips, or confusion can be an emergency. Call your local emergency services now and follow your clinician-provided emergency action plan. Do not wait for this chat.', createdAt: now }]); setDraft(''); setError(''); return;
    }
    if (busy) return;
    if (!consent) { setError('Please confirm the AI data-sharing consent before sending.'); return; }
    setBusy(true); setError('');const requestId=++requestVersion.current;
    const optimistic: Message = { role: 'user', content, createdAt: new Date().toISOString() };
    setMessages(current => [...current, optimistic]); setDraft('');
    try {
      const environment = stationData ? { coordinates: { lat: stationData.location.latitude, lon: stationData.location.longitude } } : null;
      const result = await cloudRequest('/assistant/chat', { conversationId: conversationId || undefined, message: content, consent: true, includeHealth, documents: selected.map(id => { const d = documents.find(x => x.documentId === id); return { id, name: d?.name || 'Selected report' }; }), environment });
      if(requestId!==requestVersion.current)return;
      setConversationId(result.data.conversationId); setMessages(current => [...current, { role: 'assistant', content: result.data.answer, sources: result.data.sources, createdAt: new Date().toISOString() }]);
      await refresh().catch(() => undefined);
    } catch (e) { if(requestId===requestVersion.current){setMessages(current => current.filter(m => m !== optimistic)); setDraft(content); setError(e instanceof Error ? e.message : 'The assistant request failed. Please retry.');} }
    finally { if(requestId===requestVersion.current)setBusy(false); }
  }

  return <section className="grid lg:grid-cols-[230px_1fr] gap-5 min-h-[520px]">
    <aside className="rounded-2xl border border-outline-variant p-4 space-y-3">
      <div className="flex items-center justify-between"><strong>Conversations</strong><button onClick={newConversation} aria-label="New conversation" className="p-2 rounded-lg border"><Plus className="w-4 h-4" /></button></div>
      <div className="space-y-1 max-h-56 overflow-auto">{conversations.map(c => <button key={c.conversationId} onClick={() => void openConversation(c.conversationId)} className={`w-full text-left p-2 rounded-lg text-xs truncate ${conversationId === c.conversationId ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low'}`}>{c.lastMessage || 'Conversation'}<span className="block text-[10px] opacity-70">{new Date(c.updatedAt).toLocaleString()}</span></button>)}</div>
      <div className="block text-sm font-medium pt-3 border-t"><strong>Use confirmed reports</strong>
        <div className="mt-2 space-y-2">{documents.filter(d => d.status === 'completed' && d.confirmed).map(d => <label key={d.documentId} className="flex gap-2 items-start text-xs font-normal"><input type="checkbox" checked={selected.includes(d.documentId)} onChange={e => setSelected(cur => e.target.checked ? [...cur, d.documentId] : cur.filter(id => id !== d.documentId))} /><FileText className="w-3.5 h-3.5 shrink-0" />{d.name}</label>)}</div>
      </div>
      <p className="text-[11px] text-on-surface-variant">Only documents you reviewed and confirmed can ground report answers.</p>
    </aside>
    <div className="rounded-2xl border border-outline-variant flex flex-col min-h-[520px] overflow-hidden">
      <header className="p-4 border-b flex items-center justify-between"><div className="flex gap-2 items-center"><Bot className="w-5 h-5 text-primary" /><div><strong>AirExpo Health Assistant</strong><p className="text-xs text-on-surface-variant">Health information and environmental planning</p></div></div><button onClick={() => void clearConversation()} disabled={busy} className="p-2 rounded-lg border disabled:opacity-50" aria-label="Clear conversation"><Trash2 className="w-4 h-4" /></button></header>
      <div className="flex-1 p-4 space-y-3 overflow-auto max-h-[460px]" aria-live="polite">
        {messages.length === 0 && <div className="space-y-3"><p className="text-sm">I can explain selected, reviewed report passages and environmental readings. I can’t provide medical advice, diagnose, or recommend treatment.</p><div className="flex gap-2 flex-wrap">{SUGGESTIONS.map(q => <button key={q} disabled={busy} onClick={() => { setDraft(q); }} className="rounded-full border px-3 py-2 text-xs hover:bg-surface-container-low">{q}</button>)}</div></div>}
        {messages.map((m,i) => <article key={`${m.createdAt}-${i}`} className={`max-w-[90%] rounded-2xl p-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto bg-primary text-white' : 'bg-surface-container-low'}`}><div>{m.content}</div>{m.role==='assistant'&&(m.sources?.length??0)>0&&<p className="mt-2 border-t border-outline-variant pt-2 text-xs">Reports used: {m.sources?.join(', ')}. Original files remain available in Medical reports.</p>}{m.role==='assistant'&&(m.evidence?.length??0)>0&&<details className="mt-2 border-t border-outline-variant pt-2 text-xs"><summary className="cursor-pointer font-medium">Show evidence from reviewed report text ({m.evidence?.length})</summary><div className="mt-2 space-y-2">{m.evidence?.map((item,index)=><blockquote key={`${item.document}-${item.page}-${index}`} className="border-l-2 border-primary/40 pl-2"><p>“{item.text}”</p><cite className="not-italic text-[10px] text-on-surface-variant">{item.document}{item.page?` · page ${item.page}`:''}</cite></blockquote>)}</div></details>}<time className="block mt-2 text-[10px] opacity-65">{new Date(m.createdAt).toLocaleTimeString()}</time></article>)}
        {busy && <p role="status" className="text-sm text-on-surface-variant animate-pulse">Assistant is preparing a grounded answer…</p>}
      </div>
      <div className="border-t p-4 space-y-3">
        <details className="rounded-xl border border-outline-variant p-3"><summary className="cursor-pointer text-sm font-medium">Plan a reminder</summary><form onSubmit={e=>void addReminder(e)} className="mt-3 grid sm:grid-cols-2 gap-2"><input required maxLength={160} value={reminderTitle} onChange={e=>setReminderTitle(e.target.value)} placeholder="Appointment or plan reminder" className="rounded-lg border p-2 text-sm" /><input required type="datetime-local" value={reminderDue} onChange={e=>setReminderDue(e.target.value)} className="rounded-lg border p-2 text-sm" /><select value={reminderKind} onChange={e=>setReminderKind(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="appointment">Appointment</option><option value="review_action_plan">Review action plan</option><option value="medication">Medication (clinician instruction)</option></select>{reminderKind==='medication'&&<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={clinicianConfirmed} onChange={e=>setClinicianConfirmed(e.target.checked)} />I confirm this reminder follows my clinician’s instructions</label>}<button disabled={busy||!reminderDue||(reminderKind==='medication'&&!clinicianConfirmed)} className="sm:col-span-2 rounded-lg bg-primary px-3 py-2 text-sm text-on-primary disabled:opacity-50">Save reminder</button></form><div className="mt-3 space-y-1">{reminders.map(r=><div key={r.reminderId} className="flex justify-between gap-2 text-xs"><span>{r.title} · {new Date(r.dueAt).toLocaleString()} {Date.parse(r.dueAt)<=Date.now()&&<strong>(Due)</strong>}</span><button onClick={()=>void deleteReminder(r.reminderId)} className="underline">Delete</button></div>)}{!reminders.length&&<p className="text-xs text-on-surface-variant">No reminders saved.</p>}{reminderNotice&&<p role="status" className="text-xs">{reminderNotice}</p>}</div></details>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={includeHealth} onChange={e => setIncludeHealth(e.target.checked)} /><span>Include my saved health profile and recent symptom entries for this answer.</span></label>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-[11px] space-y-1"><p><strong>Gemini data use:</strong> Sending shares your message, recent chat turns, and selected report excerpts with Google. Your original PDF stays in AirExpo storage; Gemini receives only text you reviewed and confirmed. Health profile and journal data are sent only if you separately opt in above.</p><p>Google’s terms depend on the API project’s billing status. With unpaid quota, Google may use prompts and responses to improve products and human reviewers may process them; do not submit sensitive records. With paid Gemini API service, prompts are not used to improve Google products, but may be logged for a limited time for abuse monitoring. Gemini API terms prohibit clinical practice and medical advice; AirExpo is limited to informational explanations. Check the project’s billing and terms before using real records. <a className="underline" target="_blank" rel="noreferrer" href="https://ai.google.dev/gemini-api/terms">Gemini API terms</a> · <a className="underline" target="_blank" rel="noreferrer" href="https://ai.google.dev/gemini-api/docs/zdr">Data retention details</a></p></div>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I understand and agree to send my messages, recent chat history, and selected confirmed report text to Google Gemini. Conversations are stored in my private AirExpo account for 30 days and can be deleted.</span></label>
        <p className="text-[10px] text-on-surface-variant">AQI and weather, when included, are modeled estimates from the selected dashboard location. Do not use this assistant for emergencies.</p>
        {error && <div role="alert" className="text-sm text-error">{error} <button className="underline" onClick={() => void send(draft || messages.filter(m => m.role==='user').at(-1)?.content || '')}>Retry</button></div>}
        <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex gap-2"><textarea aria-label="Message the health assistant" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();} }} rows={2} maxLength={2000} placeholder="Ask about a confirmed report, your journal, or today's air…" className="flex-1 resize-y rounded-xl border border-outline-variant p-3 text-sm" /><button disabled={busy||!draft.trim()} aria-label="Send message" className="px-4 rounded-xl bg-primary text-on-primary disabled:opacity-50"><Send className="w-4 h-4" /></button></form>
      </div>
    </div>
  </section>;
}
