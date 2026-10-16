import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  ArrowDown, ArrowRight, Check, CircleHelp, Heart, Home, ImagePlus, LogIn, LogOut, Menu, MessageCircle,
  Pencil, Plus, Search, Send, Settings, ShieldCheck, Sparkles,
  Trash2, UserRound, Users, X,
} from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim()
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const supabase = SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_KEY.includes('YOUR_')
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

const niceDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  const diff = now - date
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}분 전`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}시간 전`
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)}일 전`
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}
const initials = (name = '모아') => name.trim().slice(0, 1).toUpperCase() || '모'
const friendlyError = (error) => {
  const message = error?.message || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
  if (/invalid login credentials/i.test(message)) return '이메일 또는 비밀번호를 확인해 주세요.'
  if (/user already registered/i.test(message)) return '이미 가입된 이메일이에요. 로그인해 주세요.'
  if (/password should be at least/i.test(message)) return '비밀번호는 6자 이상으로 입력해 주세요.'
  if (/duplicate key|unique constraint|nickname_taken/i.test(message)) return '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.'
  if (/email rate limit|rate limit/i.test(message)) return '인증 메일 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  if (/invalid otp|token has expired|otp expired/i.test(message)) return '인증 코드가 올바르지 않거나 만료됐어요. 새 코드를 요청해 주세요.'
  if (/failed to fetch|fetch failed/i.test(message)) return '서버에 연결하지 못했어요. Supabase 설정과 인터넷 연결을 확인해 주세요.'
  return message
}

function Avatar({ name, size = 'normal' }) {
  return <span className={`avatar avatar-${size}`} aria-label={`${name || '모아'} 프로필`}>{initials(name)}</span>
}

function SetupScreen() {
  return (
    <main className="setup-page">
      <div className="setup-card">
        <div className="brand-mark brand-mark-large">m<span>·</span></div>
        <span className="eyebrow">MOA COMMUNITY</span>
        <h1>모아를 시작할 준비가<br />거의 끝났어요.</h1>
        <p>로그인, 이메일 인증, 게시물과 사진 저장을 연결하려면 Supabase 프로젝트 정보가 필요해요.</p>
        <div className="setup-steps">
          <div><b>01</b><span><strong>Supabase 프로젝트 만들기</strong><small>README.md의 설정 안내를 따라 주세요.</small></span></div>
          <div><b>02</b><span><strong>데이터베이스 SQL 실행</strong><small>supabase/schema.sql 전체를 SQL Editor에서 실행해요.</small></span></div>
          <div><b>03</b><span><strong>환경 변수 입력</strong><small>.env.local 또는 GitHub Actions 변수에 URL과 공개 키를 넣어요.</small></span></div>
        </div>
        <p className="setup-foot"><CircleHelp size={16} /> 보안을 위해 service_role 키는 브라우저 코드에 넣지 마세요.</p>
      </div>
    </main>
  )
}

function AuthModal({ onClose, onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [otp, setOtp] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const switchMode = (next) => { setMode(next); setError(''); setMessage('') }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    try {
      if (!supabase) throw new Error('Supabase 설정이 아직 완료되지 않았어요.')
      const cleanEmail = email.trim().toLowerCase()
      if (mode === 'signup') {
        const cleanNickname = nickname.trim()
        if (cleanNickname.length < 2 || cleanNickname.length > 18) throw new Error('닉네임은 2~18자로 입력해 주세요.')
        if (!/^[가-힣a-zA-Z0-9._-]+$/.test(cleanNickname)) throw new Error('닉네임은 한글, 영문, 숫자와 . _ - 만 사용할 수 있어요.')
        const { data: existing, error: lookupError } = await supabase.from('profiles').select('nickname')
        if (lookupError) throw lookupError
        if ((existing || []).some((row) => row.nickname?.trim().toLowerCase() === cleanNickname.toLowerCase())) {
          throw new Error('이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.')
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { nickname: cleanNickname } },
        })
        if (signUpError) throw signUpError
        if (data.session) {
          await onAuthed(data.session.user)
          onClose()
        } else {
          setPendingEmail(cleanEmail)
          setMode('verify')
          setMessage(`${cleanEmail} 주소로 인증 코드를 보냈어요. 메일함에서 코드를 확인해 주세요.`)
        }
      } else if (mode === 'login') {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        if (loginError) throw loginError
        await onAuthed(data.user)
        onClose()
      } else if (mode === 'verify') {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: pendingEmail, token: otp.trim(), type: 'email' })
        if (verifyError) throw verifyError
        await onAuthed(data.user)
        onClose()
      } else if (mode === 'resend') {
        const targetEmail = pendingEmail || cleanEmail
        const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: targetEmail })
        if (resendError) throw resendError
        setPendingEmail(targetEmail)
        setMode('verify')
        setMessage('새 인증 코드를 보냈어요. 이메일을 확인해 주세요.')
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        <div className="auth-emblem"><Sparkles size={23} /></div>
        {mode === 'verify' ? <>
          <span className="eyebrow">CHECK YOUR EMAIL</span>
          <h2 id="auth-title">메일함을 확인해 주세요</h2>
          <p className="muted">{pendingEmail}으로 보낸 인증 코드를 입력하면 가입이 완료돼요.</p>
        </> : <>
          <span className="eyebrow">A LITTLE SPACE FOR YOU</span>
          <h2 id="auth-title">{mode === 'signup' ? '모아에 함께해요' : mode === 'resend' ? '인증 코드 다시 받기' : '다시 만나 반가워요'}</h2>
          <p className="muted">{mode === 'signup' ? '이야기를 나눌 나만의 공간을 만들어 보세요.' : mode === 'resend' ? '가입에 사용한 이메일 주소를 입력해 주세요.' : '계정에 로그인하고 이야기를 이어가요.'}</p>
        </>}
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {message && <div className="notice notice-success">{message}</div>}
        <form className="auth-form" onSubmit={submit}>
          {(mode === 'login' || mode === 'signup' || (mode === 'resend' && !pendingEmail)) && <label>이메일 주소<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>}
          {mode === 'signup' && <label>닉네임<div className="field-note">다른 사람이 사용 중인 닉네임은 사용할 수 없어요.</div><input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="나를 표현하는 이름" maxLength={18} required /></label>}
          {(mode === 'login' || mode === 'signup') && <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상 입력해 주세요" minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required /></label>}
          {mode === 'verify' && <label>이메일 인증 코드<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="메일에 적힌 코드" required /></label>}
          <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? '처리 중…' : mode === 'signup' ? '가입하고 인증 코드 받기' : mode === 'verify' ? '인증하고 가입 완료' : mode === 'resend' ? '인증 코드 보내기' : '로그인'} <ArrowRight size={17} /></button>
        </form>
        {mode === 'verify' && <button className="text-button centered" onClick={() => { setMode('resend'); setError(''); setMessage('') }}>인증 코드를 받지 못했나요? 다시 보내기</button>}
        {mode === 'login' && <div className="auth-switch">아직 계정이 없나요? <button onClick={() => switchMode('signup')}>회원가입</button></div>}
        {mode === 'signup' && <div className="auth-switch">이미 가입했나요? <button onClick={() => switchMode('login')}>로그인</button></div>}
        {mode === 'resend' && <div className="auth-switch"><button onClick={() => switchMode('login')}>로그인으로 돌아가기</button></div>}
        <p className="auth-privacy"><ShieldCheck size={14} /> 계정 정보는 안전하게 보호돼요.</p>
      </section>
    </div>
  )
}

function PostCard({ post, onOpen, onDelete, currentUserId, compact = false }) {
  const author = post.author_name || post.profiles?.nickname || '모아 회원'
  return (
    <article className={`post-card ${compact ? 'post-card-compact' : ''}`}>
      <button className="post-card-main" onClick={() => onOpen(post)} aria-label={`${post.title} 게시물 보기`}>
        <div className="post-meta"><Avatar name={author} size="small" /><span className="post-author">{author}</span><span className="meta-dot">·</span><time>{niceDate(post.created_at)}</time></div>
        <h3>{post.title}</h3>
        <p className="post-excerpt">{post.content}</p>
        {post.image_url && <div className={`post-image-wrap ${compact ? 'post-image-compact' : ''}`}><img src={post.image_url} alt="게시물 첨부 사진" loading="lazy" /></div>}
      </button>
      <div className="post-card-bottom">
        <span className="comment-count"><MessageCircle size={16} /> 댓글 {post.comment_count || 0}</span>
        <div className="post-card-actions">
          {post.user_id === currentUserId && <button className="icon-button subtle-danger" title="게시물 삭제" aria-label="게시물 삭제" onClick={() => onDelete(post)}><Trash2 size={16} /></button>}
          <button className="read-more" onClick={() => onOpen(post)}>이야기 보기 <ArrowRight size={15} /></button>
        </div>
      </div>
    </article>
  )
}

function ComposeModal({ onClose, onCreated, user, profile }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (!title.trim() || !content.trim()) throw new Error('제목과 내용을 모두 입력해 주세요.')
      if (title.trim().length > 90) throw new Error('제목은 90자 이내로 작성해 주세요.')
      if (content.trim().length > 6000) throw new Error('내용은 6,000자 이내로 작성해 주세요.')
      let imageUrl = null
      let imagePath = null
      if (file) {
        if (!file.type.startsWith('image/')) throw new Error('JPG, PNG, WEBP 등 이미지 파일만 올릴 수 있어요.')
        if (file.size > 5 * 1024 * 1024) throw new Error('사진은 5MB 이하로 선택해 주세요.')
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('post-images').upload(imagePath, file, { upsert: false, contentType: file.type })
        if (uploadError) throw uploadError
        imageUrl = supabase.storage.from('post-images').getPublicUrl(imagePath).data.publicUrl
      }
      const { data, error: insertError } = await supabase.from('posts').insert({ user_id: user.id, title: title.trim(), content: content.trim(), image_url: imageUrl, image_path: imagePath }).select('id').single()
      if (insertError) {
        if (imagePath) await supabase.storage.from('post-images').remove([imagePath])
        throw insertError
      }
      await onCreated(data.id)
      onClose()
    } catch (err) { setError(friendlyError(err)) }
    finally { setBusy(false) }
  }

  return <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <section className="modal compose-modal" role="dialog" aria-modal="true" aria-labelledby="compose-title">
      <div className="modal-header"><div><span className="eyebrow">YOUR STORY</span><h2 id="compose-title">새 이야기 쓰기</h2></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></div>
      <form onSubmit={submit} className="compose-form">
        <div className="compose-author"><Avatar name={profile?.nickname || '나'} /><div><strong>{profile?.nickname || '나'}</strong><small>오늘의 이야기를 나눠 보세요.</small></div></div>
        <label className="sr-label" htmlFor="post-title">게시물 제목</label><input id="post-title" className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="어떤 이야기를 나누고 싶나요?" required />
        <label className="sr-label" htmlFor="post-content">게시물 내용</label><textarea id="post-content" className="content-input" value={content} onChange={(e) => setContent(e.target.value)} maxLength={6000} rows={7} placeholder="생각이나 일상을 자유롭게 적어 보세요…" required />
        {preview && <div className="upload-preview"><img src={preview} alt="업로드할 사진 미리보기" /><button type="button" className="remove-preview" onClick={() => setFile(null)} aria-label="사진 제거"><X size={15} /></button></div>}
        {error && <div className="notice notice-error">{error}</div>}
        <div className="compose-footer"><label className="upload-button"><ImagePlus size={18} /><span>사진 추가</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><small>이미지 최대 5MB</small><button className="button button-primary" type="submit" disabled={busy}>{busy ? '올리는 중…' : '게시하기'} <ArrowRight size={16} /></button></div>
      </form>
    </section>
  </div>
}

function PostDetailModal({ post, onClose, user, profile, onChanged }) {
  const [comments, setComments] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const loadComments = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase.from('comments').select('id, post_id, user_id, content, created_at').eq('post_id', post.id).order('created_at', { ascending: true })
    if (loadError) { setError(friendlyError(loadError)); setLoading(false); return }
    const ids = [...new Set((data || []).map((item) => item.user_id))]
    let people = []
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,nickname').in('id', ids)
      people = profiles || []
    }
    const names = Object.fromEntries(people.map((person) => [person.id, person.nickname]))
    setComments((data || []).map((item) => ({ ...item, author_name: names[item.user_id] || '모아 회원' })))
    setLoading(false)
  }, [post.id])

  useEffect(() => { loadComments() }, [loadComments])

  const addComment = async (e) => {
    e.preventDefault(); setError('')
    if (!user) { setError('댓글을 작성하려면 먼저 로그인해 주세요.'); return }
    if (!draft.trim()) return
    if (draft.trim().length > 1500) { setError('댓글은 1,500자 이내로 작성해 주세요.'); return }
    setBusy(true)
    const { error: insertError } = await supabase.from('comments').insert({ post_id: post.id, user_id: user.id, content: draft.trim() })
    if (insertError) setError(friendlyError(insertError))
    else { setDraft(''); await loadComments(); await onChanged() }
    setBusy(false)
  }

  const deleteComment = async (comment) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    const { error: deleteError } = await supabase.from('comments').delete().eq('id', comment.id)
    if (deleteError) setError(friendlyError(deleteError))
    else { await loadComments(); await onChanged() }
  }

  const author = post.author_name || post.profiles?.nickname || '모아 회원'
  return <div className="overlay detail-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="detail-topbar"><span className="eyebrow">MOA STORY</span><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></div>
      <div className="detail-scroll">
        <article className="detail-post">
          <div className="post-meta detail-author"><Avatar name={author} /><div><strong>{author}</strong><time>{niceDate(post.created_at)}</time></div></div>
          <h2 id="detail-title">{post.title}</h2>
          <p className="detail-content">{post.content}</p>
          {post.image_url && <img className="detail-image" src={post.image_url} alt="게시물 첨부 사진" />}
        </article>
        <section className="comments-section">
          <div className="section-heading"><h3>함께 나눈 이야기</h3><span>{comments.length}개의 댓글</span></div>
          {loading ? <div className="comment-loading">댓글을 불러오고 있어요…</div> : comments.length === 0 ? <div className="empty-comments"><MessageCircle size={23} /><strong>아직 댓글이 없어요.</strong><span>첫 번째 이야기를 남겨 보세요.</span></div> : <div className="comment-list">{comments.map((comment) => <article className="comment-item" key={comment.id}><Avatar name={comment.author_name} size="small" /><div className="comment-body"><div className="comment-heading"><strong>{comment.author_name}</strong><time>{niceDate(comment.created_at)}</time></div><p>{comment.content}</p></div>{(user?.id === comment.user_id) && <button className="icon-button comment-delete" onClick={() => deleteComment(comment)} title="댓글 삭제" aria-label="댓글 삭제"><Trash2 size={14} /></button>}</article>)}</div>}
          {error && <div className="notice notice-error">{error}</div>}
        </section>
      </div>
      <form className="comment-form" onSubmit={addComment}>
        <Avatar name={profile?.nickname || '나'} size="small" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={user ? '따뜻한 댓글을 남겨 보세요…' : '로그인 후 댓글을 작성할 수 있어요.'} disabled={!user || busy} maxLength={1500} />
        <button className="send-button" type="submit" disabled={!user || busy || !draft.trim()} aria-label="댓글 보내기"><Send size={18} /></button>
      </form>
    </section>
  </div>
}

function ProfilePage({ user, profile, myPosts, onSave, onDelete, onOpenPost, onSignOut }) {
  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { setNickname(profile?.nickname || ''); setBio(profile?.bio || '') }, [profile])
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setMessage(''); setError('')
    if (nickname.trim().length < 2 || nickname.trim().length > 18) { setError('닉네임은 2~18자로 입력해 주세요.'); setBusy(false); return }
    try {
      await onSave({ nickname: nickname.trim(), bio: bio.trim(), newEmail: newEmail.trim(), newPassword })
      setMessage('프로필을 저장했어요.')
      setNewEmail(''); setNewPassword('')
    } catch (err) { setError(friendlyError(err)) }
    setBusy(false)
  }

  return <div className="profile-page">
    <section className="profile-hero">
      <div className="profile-cover-shape cover-shape-one"/><div className="profile-cover-shape cover-shape-two"/>
      <div className="profile-main-avatar"><Avatar name={profile?.nickname || '나'} size="large" /></div>
      <div className="profile-hero-text"><span className="eyebrow">MY LITTLE CORNER</span><h2>{profile?.nickname || '나'}의 홈</h2><p>{profile?.bio || '나만의 이야기를 차곡차곡 모으는 공간이에요.'}</p></div>
      <div className="profile-stats"><div><strong>{myPosts.length}</strong><span>내 게시물</span></div><div><strong>{new Date(user.created_at || Date.now()).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit' })}</strong><span>함께한 날</span></div></div>
    </section>
    <div className="profile-columns">
      <section className="profile-panel settings-panel"><div className="panel-title"><div className="panel-title-icon"><Settings size={18} /></div><div><h3>개인정보 수정</h3><p>나를 소개하는 정보를 관리해요.</p></div></div>
        <form className="profile-form" onSubmit={save}>
          <label>닉네임<input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={18} required /><small>다른 회원과 중복될 수 없어요. (2~18자)</small></label>
          <label>한 줄 소개<textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={180} placeholder="나에 대해 짧게 소개해 주세요."/><small>{bio.length}/180</small></label>
          <label>가입 이메일<input value={user.email || ''} readOnly className="readonly-input" /><small>이메일을 바꾸려면 아래에 새 주소를 입력해 주세요. 확인 메일이 발송될 수 있어요.</small></label>
          <label>새 이메일 <span className="optional-label">선택</span><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="변경할 이메일 주소" /></label>
          <label>새 비밀번호 <span className="optional-label">선택</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} autoComplete="new-password" placeholder="변경할 비밀번호 (6자 이상)" /></label>
          {error && <div className="notice notice-error">{error}</div>}{message && <div className="notice notice-success"><Check size={16}/>{message}</div>}
          <button className="button button-primary button-full" disabled={busy}>{busy ? '저장 중…' : '변경 사항 저장'} <Check size={17} /></button>
        </form>
        <button className="signout-button" onClick={onSignOut}><LogOut size={16} /> 로그아웃</button>
      </section>
      <section className="profile-posts"><div className="section-heading my-post-heading"><div><span className="eyebrow">YOUR ARCHIVE</span><h3>내가 쓴 이야기</h3></div><span>{myPosts.length}개</span></div>
        {myPosts.length === 0 ? <div className="profile-empty"><div className="empty-illustration"><Pencil size={25}/></div><h4>아직 모아 둔 이야기가 없어요.</h4><p>첫 게시물을 작성하고 이곳에 기록해 보세요.</p></div> : <div className="post-list">{myPosts.map((post) => <PostCard key={post.id} post={post} compact onOpen={onOpenPost} onDelete={onDelete} currentUserId={user.id}/>)}</div>}
      </section>
    </div>
  </div>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState('home')
  const [authOpen, setAuthOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [activePost, setActivePost] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [globalError, setGlobalError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)

  const fetchProfile = useCallback(async (uid) => {
    if (!supabase || !uid) { setProfile(null); return null }
    const { data, error } = await supabase.from('profiles').select('id,nickname,bio,created_at').eq('id', uid).maybeSingle()
    if (error) { setGlobalError(friendlyError(error)); return null }
    setProfile(data)
    return data
  }, [])

  const fetchPosts = useCallback(async () => {
    if (!supabase) return
    setGlobalError('')
    const { data, error } = await supabase.from('posts').select('id,user_id,title,content,image_url,image_path,created_at').order('created_at', { ascending: false }).limit(100)
    if (error) { setGlobalError(friendlyError(error)); setPosts([]); return }
    const rows = data || []
    const ids = [...new Set(rows.map((row) => row.user_id))]
    const postIds = rows.map((row) => row.id)
    let people = []; let comments = []
    if (ids.length) {
      const { data: pData } = await supabase.from('profiles').select('id,nickname').in('id', ids)
      people = pData || []
    }
    if (postIds.length) {
      const { data: cData } = await supabase.from('comments').select('post_id').in('post_id', postIds)
      comments = cData || []
    }
    const names = Object.fromEntries(people.map((person) => [person.id, person.nickname]))
    const counts = comments.reduce((acc, comment) => { acc[comment.post_id] = (acc[comment.post_id] || 0) + 1; return acc }, {})
    setPosts(rows.map((row) => ({ ...row, author_name: names[row.user_id] || '모아 회원', comment_count: counts[row.id] || 0 })))
  }, [])

  const refreshAll = useCallback(async (currentUser = user) => {
    await Promise.all([fetchPosts(), currentUser?.id ? fetchProfile(currentUser.id) : Promise.resolve(null)])
  }, [fetchPosts, fetchProfile, user])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let live = true
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) setGlobalError(friendlyError(error))
      if (!live) return
      const current = data.session?.user || null
      setUser(current)
      await Promise.all([fetchPosts(), current?.id ? fetchProfile(current.id) : Promise.resolve(null)])
      if (live) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const current = session?.user || null
      setUser(current)
      if (event === 'SIGNED_OUT') { setProfile(null); setPage('home') }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        // Avoid Supabase calls inside the auth callback; schedule them after it returns.
        setTimeout(() => { if (current?.id) fetchProfile(current.id) }, 0)
      }
    })
    return () => { live = false; listener.subscription.unsubscribe() }
  }, [fetchPosts, fetchProfile])

  const myPosts = useMemo(() => posts.filter((post) => post.user_id === user?.id), [posts, user?.id])
  const visiblePosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return posts
    return posts.filter((post) => `${post.title} ${post.content} ${post.author_name}`.toLowerCase().includes(term))
  }, [posts, searchTerm])

  const signedIn = async (incomingUser) => {
    setUser(incomingUser)
    await fetchProfile(incomingUser.id)
    await fetchPosts()
    setNotice('반가워요! 모아에 로그인했어요.')
    setPage('home')
  }

  const saveProfile = async ({ nickname, bio, newEmail, newPassword }) => {
    if (!supabase || !user) throw new Error('로그인이 필요해요.')
    if (!/^[가-힣a-zA-Z0-9._-]+$/.test(nickname)) throw new Error('닉네임은 한글, 영문, 숫자와 . _ - 만 사용할 수 있어요.')
    const { data: allProfiles, error: lookupError } = await supabase.from('profiles').select('id,nickname')
    if (lookupError) throw lookupError
    if ((allProfiles || []).some((row) => row.id !== user.id && row.nickname?.trim().toLowerCase() === nickname.toLowerCase())) {
      throw new Error('이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.')
    }
    const { error: updateError } = await supabase.from('profiles').update({ nickname, bio }).eq('id', user.id)
    if (updateError) throw updateError
    if (newEmail && newEmail.toLowerCase() !== (user.email || '').toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({ email: newEmail })
      if (emailError) throw emailError
      setNotice('새 이메일 주소로 확인 메일을 보냈어요. 메일에서 변경을 완료해 주세요.')
    }
    if (newPassword) {
      if (newPassword.length < 6) throw new Error('새 비밀번호는 6자 이상이어야 해요.')
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword })
      if (passwordError) throw passwordError
    }
    await Promise.all([fetchProfile(user.id), fetchPosts()])
  }

  const deletePost = async (post) => {
    if (!user || user.id !== post.user_id) return
    if (!window.confirm('이 게시물을 삭제할까요? 댓글도 함께 삭제돼요.')) return
    setGlobalError('')
    if (post.image_path) {
      const { error: fileError } = await supabase.storage.from('post-images').remove([post.image_path])
      if (fileError) { setGlobalError(`사진 삭제 알림: ${friendlyError(fileError)}`) }
    }
    const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('user_id', user.id)
    if (error) setGlobalError(friendlyError(error))
    else { if (activePost?.id === post.id) setActivePost(null); await fetchPosts(); setNotice('게시물을 삭제했어요.') }
  }

  const navigate = (nextPage) => {
    if (nextPage === 'profile' && !user) { setAuthOpen(true); setMobileMenu(false); return }
    setPage(nextPage); setMobileMenu(false); setSearchTerm('')
    if (nextPage === 'profile') refreshAll(user)
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setPage('home'); setNotice('로그아웃했어요.')
  }

  const createPostDone = async (postId) => {
    await fetchPosts()
    setNotice('새 이야기를 게시했어요.')
    // New posts are at the top; keep the user on the feed.
    setPage('home')
  }

  if (!supabase) return <SetupScreen />

  return <div className="app-shell">
    <header className="mobile-header">
      <button className="brand-button" onClick={() => navigate('home')}><span className="brand-mark">m<span>·</span></span><span className="brand-word">모아</span></button>
      <button className="icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="메뉴 열기">{mobileMenu ? <X size={22}/> : <Menu size={22}/>}</button>
    </header>
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <button className="brand-button sidebar-brand" onClick={() => navigate('home')}><span className="brand-mark">m<span>·</span></span><span><b className="brand-word">모아</b><small>이야기를 모으다</small></span></button>
      <div className="sidebar-label">MENU</div>
      <nav className="side-nav">
        <button className={page === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={19}/><span>홈 피드</span></button>
        <button className={page === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><UserRound size={19}/><span>마이 홈</span></button>
      </nav>
      <div className="sidebar-note"><div className="note-stars"><Sparkles size={18}/></div><strong>오늘의 작은 기록</strong><p>평범한 하루도<br/>모아 두면 특별해져요.</p><span>YOUR SPACE, YOUR STORY</span></div>
      <div className="sidebar-bottom">
        {user ? <><div className="signed-user"><Avatar name={profile?.nickname || '나'} size="small"/><div><strong>{profile?.nickname || '내 계정'}</strong><small>{user.email}</small></div></div><button className="sidebar-signout" onClick={signOut}><LogOut size={16}/> 로그아웃</button></> : <button className="button button-primary button-full" onClick={() => setAuthOpen(true)}><LogIn size={17}/> 로그인 / 가입</button>}
        <div className="sidebar-legal">가볍게 나누고, 다정하게 연결돼요. <span>© MOA 2026</span></div>
      </div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기"/>}
    <main className="main-area">
      <div className="topbar"><div className="breadcrumb"><span>모아</span><span className="crumb-divider">/</span><strong>{page === 'profile' ? '마이 홈' : '홈 피드'}</strong></div><div className="topbar-actions"><label className="search-box"><Search size={17}/><input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); if (page !== 'home') setPage('home') }} placeholder="이야기 검색" aria-label="이야기 검색"/><kbd>⌘ K</kbd></label><button className="topbar-avatar" title={user ? '마이 홈' : '로그인'} onClick={() => user ? navigate('profile') : setAuthOpen(true)}>{user ? <Avatar name={profile?.nickname || '나'} size="small"/> : <UserRound size={18}/>}</button></div></div>
      {notice && <div className="global-notice"><Check size={16}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="알림 닫기"><X size={15}/></button></div>}
      {globalError && <div className="global-error"><CircleHelp size={17}/><span>{globalError}</span><button onClick={() => setGlobalError('')} aria-label="오류 닫기"><X size={15}/></button></div>}
      {loading ? <div className="loading-state"><span className="spinner"/><p>모아의 이야기를 불러오고 있어요…</p></div> : page === 'home' ? <div className="feed-page">
        <section className="welcome-banner"><div className="banner-grain"/><div className="welcome-copy"><span className="eyebrow"><Sparkles size={14}/> A PLACE TO GATHER STORIES</span><h1>오늘의 이야기를<br/><em>모아</em> 볼까요?</h1><p>일상 속 작은 생각부터 좋아하는 것까지,<br className="desktop-break"/> 편안하게 나누는 우리들의 공간.</p><button className="button button-light" onClick={() => user ? setComposeOpen(true) : setAuthOpen(true)}><Plus size={17}/> 이야기 작성하기</button></div><div className="banner-art" aria-hidden="true"><div className="art-orbit orbit-a"/><div className="art-orbit orbit-b"/><div className="art-sun"/><div className="art-card art-card-back"><span>little things</span><div className="art-lines"/></div><div className="art-card art-card-front"><div className="art-card-icon"><Heart size={20} fill="currentColor"/></div><strong>Dear today,</strong><span>keep the good bits.</span><div className="art-card-scribble">~</div></div><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span></div><div className="banner-bottom"><span><Users size={15}/> 모두의 이야기 공간</span><span>SCROLL TO EXPLORE <ArrowDown size={14}/></span></div></section>
        <section className="feed-section"><div className="feed-heading"><div><span className="eyebrow">COMMUNITY FEED</span><h2>{searchTerm ? '검색 결과' : '새로운 이야기'} <span className="heading-count">{visiblePosts.length}</span></h2><p>{searchTerm ? `“${searchTerm}”에 대한 이야기를 모았어요.` : '다른 사람들의 오늘을 만나 보세요.'}</p></div><div className="feed-heading-actions"><button className="sort-chip active"><Sparkles size={15}/> 최신 이야기</button><button className="button button-primary write-button" onClick={() => user ? setComposeOpen(true) : setAuthOpen(true)}><Plus size={17}/> 글쓰기</button></div></div>
          {visiblePosts.length === 0 ? <div className="feed-empty"><div className="empty-illustration"><Pencil size={27}/></div><h3>{searchTerm ? '검색 결과가 없어요.' : '첫 번째 이야기를 기다리고 있어요.'}</h3><p>{searchTerm ? '다른 단어로 검색해 보세요.' : '오늘의 생각을 모아의 첫 게시물로 남겨 보세요.'}</p>{!searchTerm && <button className="button button-primary" onClick={() => user ? setComposeOpen(true) : setAuthOpen(true)}><Plus size={17}/> 첫 게시물 작성하기</button>}</div> : <div className="post-list">{visiblePosts.map((post) => <PostCard key={post.id} post={post} currentUserId={user?.id} onOpen={setActivePost} onDelete={deletePost}/>)}</div>}
          <div className="feed-end"><span/> 여기까지 모아 봤어요 <span/></div>
        </section>
      </div> : <ProfilePage user={user} profile={profile} myPosts={myPosts} onSave={saveProfile} onDelete={deletePost} onOpenPost={setActivePost} onSignOut={signOut}/>}
      <footer className="mobile-footer">작은 이야기가 모여, 우리의 공간이 돼요. <span>MOA · 2026</span></footer>
    </main>
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={signedIn}/>}
    {composeOpen && user && <ComposeModal onClose={() => setComposeOpen(false)} onCreated={createPostDone} user={user} profile={profile}/>}
    {activePost && <PostDetailModal key={activePost.id} post={activePost} onClose={() => setActivePost(null)} user={user} profile={profile} onChanged={fetchPosts}/>}
    <nav className="mobile-bottom-nav"><button className={page === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={20}/><span>홈</span></button><button onClick={() => user ? setComposeOpen(true) : setAuthOpen(true)} className="mobile-create"><Plus size={22}/><span>글쓰기</span></button><button className={page === 'profile' ? 'active' : ''} onClick={() => navigate('profile')}><UserRound size={20}/><span>마이 홈</span></button></nav>
  </div>
}
