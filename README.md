# Hemmaplan · Team Söderort U16F

Mobilanpassad svensk MVP för hemmamatcher, familjernas bemanning och sekretariatsinstruktioner. React, TypeScript, Vite, Tailwind och Supabase. Frontend publiceras på GitHub Pages; GitHub Actions sköter synk utan en egen kontinuerlig server.

**Status:** lokal implementation med fiktiva demodata. Ingen riktig bemanning har importerats och ingen extern databas eller webbplats har skapats. Konton, hemligheter och publicering behöver konfigureras enligt guiden nedan. Originalarbetsboken har enbart lästs.

## Starta lokalt

Använd Node 22 eller senare.

```sh
npm ci
npm run dev
```

Öppna adressen Vite skriver ut, normalt http://127.0.0.1:5173/. Utan Supabase-konfiguration startar appen i ett tydligt märkt demoläge. Demomatcher och familjer är helt fiktiva. Bemanningsändringar i demo finns bara i minnet tills sidan laddas om. Import av riktiga uppgifter kan förhandsvisas men inte sparas i demo.

```sh
npm test
npm run build
```

Tester omfattar källtolkning, sommar-/vintertid, stabila match-ID, fördelning, Excel-förhandsvisning samt SQL-migrationer och RLS i lokal PostgreSQL via PGlite. Inga konton eller hemligheter behövs. Databastesterna använder en minimal Auth-modell; de ersätter inte slutkontrollen mot ditt verkliga Supabase-projekt.

En extra Chrome-kontroll finns i `scripts/browser-check.mjs`. Starta först Vite och kör `node scripts/browser-check.mjs`. På andra operativsystem anger du `CHROME_PATH` till installerad Chrome. Kontrollskriptet använder fiktiva data, kontrollerar tre huvudflikar, filter, bemanning, instruktioner, integritet och horisontellt överflöde. Skärmbilder hamnar i `/tmp/`.

## 1. Skapa Supabase-projektet

1. Skapa ett projekt i ditt eget Supabase-konto och välj lämplig EU-region.
2. Öppna SQL Editor och kör **först** `supabase/migrations/001_initial.sql`, **sedan** `002_manual_import.sql`. Kör dem en gång i ett tomt projekt. Alternativt använd Supabase CLI och `supabase db push` efter länkning av projektet.
3. Under Authentication, aktivera e-postinloggning. Konfigurera fungerande e-postleverans för riktiga föräldrar och prova en engångslänk till en extern adress.
4. Sätt **Site URL** till frontendens slutliga adress, exempelvis `https://DITT-NAMN.github.io/hockey-app/`. Lägg exakt samma adress bland tillåtna Redirect URLs. För lokal utveckling lägger du också till `http://127.0.0.1:5173/`.
5. Kopiera `.env.example` till `.env.local`. Fyll endast i frontendens projekt-URL och publika anon-nyckel:

```dotenv
VITE_SUPABASE_URL=https://DITT-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=DIN_PUBLIKA_ANON_NYCKEL
VITE_BASE_PATH=/
```

Använd projektets publika anon-nyckel, aldrig service_role. Starta om Vite efter ändring. Hemliga nycklar får aldrig ha prefixet `VITE_`.

## 2. Skapa första administratören

1. Logga in via appen med din e-post. Den första inloggningen skapar ett **icke godkänt föräldrakonto**.
2. I Supabase SQL Editor hittar du användarens UUID:

```sql
select id, email, approved, role from public.profiles;
```

3. Upphöj endast det verifierade kontot genom dess UUID:

```sql
update public.profiles
set approved = true, role = 'ADMIN'
where id = 'ERSÄTT-MED-DITT-VERIFIERADE-UUID';
```

4. Uppdatera vyn. Du får nu Administration.

Ingen kan bli administratör genom egna Auth-metadata. Behörigheten läses från databasen vid varje skyddat anrop. Behåll minst en godkänd administratör. UI förhindrar att du återkallar eller degraderar ditt eget konto.

## 3. Koppla GitHub och publicera frontend

1. Skapa ett GitHub-repo med Pages-stöd för ditt konto. Lägg upp projektets källkod och låsfil. Importfiler, `.env*`, `dist` och personuppgifter ska inte följa med. `.gitignore` är förberedd. Projektets Git-repo kan användas direkt. Om du klonar det på en ny dator kör du `npm ci` innan du startar appen.
2. Gå till **Settings → Secrets and variables → Actions → Variables**. Lägg till de två publika repository-variablerna:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Under **Actions → Secrets** lägger du separat till:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (hemlig, enbart till synkjobbet)
4. Under **Settings → Pages → Source**, välj **GitHub Actions**.
5. Lägg koden på branchen `main`. Workflow `deploy.yml` testar, bygger och publicerar endast `dist/`. Projektets namn blir automatiskt Vite base path. För en rotwebbplats (`namn.github.io`) eller egen domän ändrar du `VITE_BASE_PATH` i workflow till `/`.
6. Kontrollera den URL Pages ger dig och uppdatera Supabase Redirect URLs enligt steg 1.

Appen använder hash-routing (`/#matcher`, `/#mina` osv.), vilket fungerar på GitHub Pages utan serveromskrivningar. Auth-klienten behandlar inloggningslänken och ordinarie navigering fungerar sedan via hash.

## 4. Aktivera Swehockey-synk

1. Kontrollera att båda GitHub-secrets i steg 3 är satta.
2. Öppna **Actions → Synkronisera hemmamatcher → Run workflow** på `main`.
3. Kontrollera jobbloggen. I appen väljer du **Uppdatera vy**. Åtta verifierade hemmamatcher hittades vid källkontrollen 2026-11-05, men källan kan ha förändrats sedan dess.
4. Schemat kör därefter vid minut 17 var sjätte timme i UTC. GitHub kan fördröja schemalagda jobb och kan pausa dem i inaktiva repo; övervaka senaste lyckade uppdatering i appen. Detta är ingen exakt tids- eller tillgänglighetsgaranti.

Två offentliga scheman läses en gång per körning. Inga privata API:er, webbläsarkakor eller kringgående av åtkomstskydd används. Om en källa misslyckas skrivs inga matchändringar från körningen; ett felloggmeddelande sparas om databasen går att nå. Matchernas gamla data och all bemanning finns kvar. Källändringar kräver ibland en parseruppdatering. Se `docs/analysis.md`.

### Starta synken från appens administratörsvy

GitHub Actions kan alltid startas manuellt från GitHub. För knappen i appen används en liten Supabase Edge Function som verifierar aktuell administratör och ber GitHub starta samma workflow. Den kör inte en kontinuerlig server.

1. Skapa en GitHub fine-grained token för **endast detta repo**, med repository permission **Actions: Read and write** och ett lämpligt utgångsdatum. Ge inte åtkomst till andra repo.
2. Sätt följande **Supabase Edge Function secrets** i Supabase Dashboard eller CLI. Klistra aldrig in token i chatten, frontend, `.env` med `VITE_`, eller repot:
   - `GITHUB_DISPATCH_TOKEN`: token från föregående steg
   - `GITHUB_REPOSITORY`: `ÄGARE/REPONAMN`
   - `APP_ORIGIN`: frontendens origin, exempelvis `https://DITT-NAMN.github.io` (utan repo-sökväg)
3. Deploya funktionen med Supabase CLI efter `supabase login` och projektlänkning:

```sh
supabase functions deploy dispatch-sync
```

4. Prova knappen som administratör. Funktionen verifierar Supabase-sessionen och databasrollen. Högst en begäran tillåts var femte minut. En lyckad begäran betyder att jobbet är startat; uppdatera vyn efter körningen för resultatet. Förnya GitHub-token när den löper ut.

## 5. Förhandsvisa och godkänn Excel-import

1. Kör en lyckad matchsynchronisering först, eller använd den manuella reservimporten nedan.
2. Behåll originalfilen privat. Lägg vid behov en **kopia** i `import/` (ignoreras av Git). Appen läser en fil du själv väljer och ändrar aldrig originalet.
3. Administration → **Välj Excel-fil**. Arbetsbokens fyra blad är analyserade; importen läser schema, spelar-/behörighetslistan och hallinstruktionerna. Lathunden för anteckningar är tom och dess kolumnstruktur visas på instruktionssidan.
4. Läs varningarna. En entydig datum- och motståndarmatch föreslås men är inte godkänd automatiskt. Kontrollera tävling, motståndare, arena och det officiella matchnumret i varje rad. Välj manuellt när datum saknas eller namnen skiljer sig. Samma match kan inte väljas för flera Excel-rader.
5. Kontrollera dubbelbemanning inom familjer, saknade behörighetsmarkeringar och alla instruktioner. **Originalet har tilldelningar som inte alltid motsvarar Ja-flaggorna.** Rätta vid behov en privat kopia efter samråd med lagledaren. Det finns inga tysta behörighetsundantag.
6. Bekräfta varje rad och godkänn att uppgifterna får sparas. Först därefter aktiveras importknappen. Importen är en databastransaktion: ett fel rullar tillbaka allt.
7. Samma familjenamn och match-/uppgiftskoppling skapar inga dubletter. Om en befintlig bemanning skiljer sig avbryts hela importen. Ändra eller töm den berörda uppgiften manuellt först. Behörighetsflaggor och instruktioner uppdateras från den godkända filen.

Importen laddas inte upp till någon filserver och originalarbetsboken lagras inte i databasen. De godkända tabelluppgifterna sparas i Supabase. Namnen avser spelare/familjer; föräldrakonton kopplas separat. Stavningsskillnader mellan olika familjenamn behöver administratören lösa; de slås aldrig ihop automatiskt.

## 6. Ge föräldrar åtkomst

Be föräldrar logga in med sin e-post, eller skicka en engångslänk från administrationens inbjudningsformulär. De får ingen åtkomst till lagets uppgifter innan godkännande.

Under **Administration → Användare & godkännande** väljer du rätt familj, rollen Förälder och **Godkänn**. Två vuxna kan kopplas till samma familj. Båda ser familjens pass. Föräldrar har läsrättigheter; RLS stoppar skrivning även via direkta API-anrop. Återkalla kontot när personen inte längre ska ha åtkomst.

## Manuell matchimport om automatisk läsning misslyckas

Använd **Administration → Manuell matchimport**. Klistra in en JSON-lista med objekt enligt denna **mall**. Ersätt alla platshållare med verifierade uppgifter från rätt tävling. Mallens värden ska inte importeras som matchdata.

```json
[
  {
    "id": "21495:OFFICIELLT_NUMERISKT_MATCHNUMMER",
    "competition": "21495",
    "source_id": "OFFICIELLT_NUMERISKT_MATCHNUMMER",
    "starts_at": "ÅÅÅÅ-MM-DDTHH:MM:00+01:00",
    "home_team": "Team Söderort(FOC/THH)",
    "away_team": "EXAKT NAMN FRÅN KÄLLAN",
    "arena": "VERIFIERAD ARENA",
    "status": "scheduled",
    "needs_review": false
  }
]
```

`competition` är `21495` (serie) eller `22208` (DM). `source_id` är det stabila numeriska matchnumret som visas på matchtidens tooltip i schemat, **inte** länken `/Game/Events/...`. `id` måste vara `competition:source_id`. `starts_at` behöver explicit UTC eller offset: `+01:00` vintertid och `+02:00` sommartid i Stockholm. Sätt `null` och `needs_review: true` för obekräftad tid. Status kan vara `scheduled`, `finished`, `postponed` eller `cancelled`.

Läs JSON i textrutan och bekräfta källkontrollen före sparande. Importen bevarar bemanning och match-ID och loggar ändringar. Den markerar inte andra matcher som saknade och räknas inte som en lyckad automatisk synk. Nästa lyckade Swehockey-synk återställer källans värden; manuella ändringar är inte permanenta undantag från källan.

## Arkitektur och underhåll

- `src/App.tsx`: appskal, sidhuvud och de tre huvudflikarna.
- `src/pages/`: separata sidor för matcher, mina pass, info och administration.
- `src/components/`: återanvändbara matchkort, bemanning, dialoger och formulär.
- `src/hooks/useHockeyApp.ts`: inloggning, dataladdning och ändringar mot Supabase.
- `src/lib/types.ts`: typer, behörighetskontroll och Excel-lik fördelningsberäkning.
- `src/lib/excel.ts`: skrivskyddad browserbaserad XLSX-läsning och förhandsvisning. Formler exekveras inte.
- `src/lib/swehockey.ts`: strikt parser för de verifierade HTML-schemana och Stockholm-tider.
- `scripts/sync.ts`: serverhemligheter läses enbart från miljön i GitHub Actions.
- `supabase/migrations/`: constraints, RLS, trigger för uppgiftsbehörigheter, atomiska importer och synk.
- `supabase/functions/dispatch-sync/`: skyddad start av GitHub-workflow.

Datamodellen använder `families` i stället för separata spelare/föräldrar eftersom arbetsboken räknar uppdrag per spelarnamn/familj. `profiles` kopplar Auth-konton till familjer. `matches` har stabil sammansatt källnyckel. `assignments` har en unik rad per match och uppgift. `assignment_types`, `instructions`, `sync_logs`, `match_changes` och `sync_requests` täcker uppgiftstyper, privat information och loggning. Ny matchtid ändrar bara matchraden. Ingen automatisk radering av matcher eller bemanning sker.

Alla sex platser väger lika. Båsdörrarna summeras tillsammans. Behörighet är ett villkor för tilldelning, inte en vikt i statistiken. Statistiken visar tilldelade uppdrag, inte närvaro eller genomförda timmar. Den omfattar alla importerade matcher; det finns inga säsongsfilter eller automatiska ersättningsregler i denna MVP.

## Integritet, radering och driftkontroll

Innan skarp användning: ange lagets ansvariga kontakt, lagringsperiod och gallringsrutin i appens integritetstext. Förvara exportfiler privat och begränsa antalet administratörer. Hallinstruktionerna kan innehålla privata koder och är därför skyddade av samma RLS som bemanningen.

- Återkalla godkännande omedelbart i appen när åtkomst ska tas bort. RLS kontrollerar detta även för en tidigare utfärdad session.
- Radera en användare via Supabase Authentication → Users. Profilen raderas automatiskt. Detta raderar inte familjens pass om en annan vuxen fortfarande använder samma familj.
- För radering av en hel familj: verifiera familjens UUID och kopplingar, ta bort familjen i Supabase Table Editor. Tilldelningar raderas genom FK-cascade och profilerna förlorar familjekopplingen. Radera även berörda Auth-konton när det är avsikten. Genomför inte familjeradering om andra vuxnas uppgifter ska bevaras.
- `match_changes` innehåller matchuppgifter, inte familjenamn. `sync_requests` har `ON DELETE SET NULL` för användarkopplingen. Synkloggar skriver inte e-post eller bemanning.
- Radering behöver även omfatta privata Excel-kopior och exporter. Hantera eventuella databasbackuper enligt projektets faktiska gallrings-/backupinställningar.
- Före föräldralansering: prova engångslänk, godkännande, två olika familjekonton, ett återkallat konto, nekad skrivning som förälder, manuell synk och flyttad match i ditt riktiga Supabase-projekt. Inga externa integrationer är verifierade med dina konton ännu.

Teknikreferenser: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [engångslänkar](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Vite på GitHub Pages](https://vite.dev/guide/static-deploy.html), [GitHub workflow-utlösning](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Kodformatering

Filerna använder två mellanslag för indrag, riktiga radbrytningar och en radbredd på 90 tecken. Inställningarna finns i `.prettierrc.json` och `.editorconfig`. Byggda filer i `dist/` är automatiskt komprimerade; redigera källkoden i `src/`.

```sh
npm run format
npm run format:check
```

Gränssnittet följer UX-skissen med mörkblått sidhuvud, matchkort och tre fasta flikar: Matcher, Mina pass och Info. Administration öppnas via kugghjulet. De två båsdörrsplatserna visas separat så att båda tilldelningarna syns.
