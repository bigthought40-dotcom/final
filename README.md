# 모아(MOA) 커뮤니티

모바일과 PC에서 함께 사용할 수 있는 게시판 프로젝트입니다. React + Vite로 화면을 만들고, Supabase Auth / Database / Storage로 로그인, 이메일 인증, 게시물, 댓글, 사진을 저장합니다. 정적 사이트인 GitHub Pages에 배포할 수 있습니다.

## 들어 있는 기능

- 이메일 + 비밀번호 회원가입 및 이메일 인증 코드 확인
- 로그인 세션 자동 유지(현재 브라우저/기기)와 여러 기기에서 같은 계정으로 로그인
- 대소문자를 구분하지 않는 닉네임 중복 방지(DB 제약 조건 포함)
- 게시물 등록, 사진 첨부(JPG/PNG/WEBP/GIF, 최대 5MB), 게시물 상세 보기
- 게시물 상세 화면 안에서 댓글을 함께 보고 작성·삭제
- 마이 홈: 내가 쓴 게시물 확인, 닉네임·소개글·이메일·비밀번호 수정
- 본인 게시물 삭제, 게시물 검색, 모바일 반응형 메뉴와 작성 화면
- 데이터베이스 Row Level Security(RLS) 정책

## 1. Supabase 연결하기

1. [Supabase](https://supabase.com/)에서 새 프로젝트를 만듭니다.
2. 프로젝트의 **SQL Editor**를 열고 `supabase/schema.sql` 파일 전체를 붙여 넣어 실행합니다. 이 스크립트가 프로필/게시물/댓글 테이블, 닉네임 고유성, 접근 정책, 사진 저장소를 설정합니다.
3. Supabase 대시보드에서 **Project Settings → API** 또는 **Connect** 화면으로 이동해 Project URL과 **Publishable key**를 복사합니다. 이전 프로젝트라면 `anon` 공개 키를 사용해도 됩니다.
4. 로컬 개발용으로 이 폴더의 `.env.example`을 `.env.local`로 복사한 뒤 값을 채웁니다.

```env
VITE_SUPABASE_URL=https://내프로젝트.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=내_publishable_또는_anon_공개키
```

브라우저에 들어가는 키이므로 **Publishable/anon 키만** 사용합니다. `service_role` 또는 Secret API key를 `.env.local`, GitHub 저장소, 브라우저 코드에 절대 넣지 마세요. 테이블과 스토리지의 RLS 정책은 공개 키와 함께 사용하도록 구성돼 있습니다.

## 2. 이메일 인증 코드 설정

1. Supabase Dashboard의 **Authentication → Sign In / Providers → Email**에서 이메일 로그인을 켜고, 실제 배포 환경에서는 이메일 확인(Confirm email)을 활성화합니다.
2. **Authentication → Email Templates → Confirm signup** 템플릿의 본문에 인증 코드 변수 `{{ .Token }}`가 들어 있는지 확인합니다. 예를 들면 다음처럼 사용할 수 있습니다.

```html
<h2>모아 회원가입 인증</h2>
<p>아래 코드를 모아 화면에 입력해 주세요.</p>
<p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
```

3. **Authentication → URL Configuration**에서 배포한 사이트 주소를 Site URL과 허용 주소(Additional Redirect URLs)에 추가합니다. 예: `https://내아이디.github.io/내저장소/`
4. Supabase 기본 메일 발송은 테스트/제한이 있을 수 있습니다. 다른 사람에게 실제로 서비스할 때는 Authentication의 SMTP 설정에서 신뢰할 수 있는 SMTP 제공자를 연결하는 것을 권장합니다.

공식 안내: [Supabase 이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates), [React 인증 가이드](https://supabase.com/docs/guides/auth/quickstarts/react)

## 3. 내 PC에서 실행하기

Node.js 20 이상을 설치한 뒤 터미널에서 프로젝트 폴더로 이동합니다.

```bash
npm install
npm run dev
```

터미널에 표시되는 로컬 주소(보통 `http://localhost:5173`)를 열어 확인합니다. `.env.local`을 수정한 후에는 개발 서버를 다시 시작하세요.

배포용 빌드는 아래 명령으로 확인할 수 있습니다.

```bash
npm run build
npm run preview
```

## 4. GitHub Pages에 배포하기

1. 이 프로젝트 파일 전체를 새 GitHub 저장소에 업로드하고 기본 브랜치 이름을 `main`으로 맞춥니다.
2. 저장소의 **Settings → Secrets and variables → Actions → Variables**에서 다음 Repository variables 두 개를 추가합니다.
   - `VITE_SUPABASE_URL` = Supabase Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase Publishable/anon 공개 키
3. 저장소의 **Settings → Pages → Build and deployment → Source**를 `GitHub Actions`로 설정합니다.
4. `main` 브랜치에 push하거나 **Actions** 탭에서 `Deploy Moa to GitHub Pages` workflow를 수동 실행합니다.
5. 배포가 끝나면 GitHub Pages URL로 접속합니다. 첫 배포 후 그 주소를 Supabase의 URL Configuration에도 등록해야 인증 메일 설정이 맞습니다.

배포 자동화 파일은 `.github/workflows/deploy.yml`에 있습니다. 사이트가 저장소의 `/저장소이름/` 경로 아래에 올라가도 리소스 경로가 동작하도록 상대 경로 빌드를 사용합니다.

공식 안내: [Vite의 GitHub Pages 배포](https://vite.dev/guide/static-deploy.html)

## PC와 모바일 로그인에 관해

PC에서 이미 로그인한 세션을 모바일 브라우저에 자동 복사하는 것은 보안상 일반적으로 지원하지 않습니다. 대신 PC와 모바일에서 **같은 이메일/비밀번호 계정으로 각각 로그인**하면 Supabase에 저장된 같은 프로필·게시물·댓글·사진을 불러옵니다. 로그인 상태는 각 기기의 해당 브라우저에 유지되므로, 다른 브라우저나 시크릿 모드에서는 다시 로그인해야 할 수 있습니다.

## 보안 및 운영 참고

- 게시물/댓글/닉네임/소개글과 첨부 이미지는 이 기본 구성에서 공개 게시판 데이터입니다. 민감한 개인정보나 비밀번호를 게시물에 올리지 마세요.
- 이메일 주소는 `profiles` 공개 테이블에 저장하지 않고 Supabase Auth에서 관리합니다.
- 사진은 공개 버킷에 저장되므로 게시물 링크를 아는 사람은 사진을 볼 수 있습니다. 비공개 사진이 필요하면 private bucket과 signed URL 설계가 필요합니다.
- 서비스가 커지면 스팸 방지, 신고/차단, 관리자 도구, 게시물 페이지네이션, SMTP 발송 한도 및 사용량을 추가로 관리해야 합니다.
- 이 프로젝트는 Supabase에 연결한 뒤 완성되는 스타터 프로젝트입니다. Supabase 프로젝트를 대신 생성하거나 사용자의 GitHub 계정에 대신 배포하지는 않습니다.

## 주요 파일

```text
moa-community/
├── .github/workflows/deploy.yml  # GitHub Pages 자동 배포
├── src/App.jsx                   # 로그인/피드/게시물/댓글/마이 홈
├── src/styles.css                # 데스크톱 및 모바일 디자인
├── src/main.jsx                  # React 시작점
├── supabase/schema.sql           # 테이블, 닉네임 중복 방지, RLS, 사진 저장소
├── .env.example                  # Supabase 설정 예시
├── index.html
└── vite.config.js
```
