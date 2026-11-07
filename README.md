# Seket · hemmamatcher och sekretariatsbemanning

Svensk mobilanpassad React/TypeScript-app med Material UI (MUI), Supabase Auth, PostgreSQL och RLS. Frontend kan köras på GitHub Pages och matchsynk via GitHub Actions. Inga riktiga personuppgifter ingår i repo eller demo.

**Databasen är nu förberedd för flera föreningar och lag. Migrationerna är omskrivna för ett nytt, tomt Supabase-projekt där inga tidigare appmigrationer har körts.** Ingen ändring har gjorts i det riktiga Supabase-projektet. Kör inte dessa initialmigrationer ovanpå den gamla modellen eller en databas med appdata; en sådan uppgradering kräver en separat datamigrering.

## Lokal start och kontroller

Node 22 eller senare:

```sh
npm ci
npm run dev
npm test
npm run build
npm run format:check
```

Utan Supabase-URL och publik nyckel visas en tydligt märkt demo. Demomatcher och familjer är fiktiva; ändringar sparas bara i minnet. Import av personuppgifter kan förhandsvisas men aldrig sparas i demoläget. Originalarbetsboken ändras inte.

## Datamodell och isolering

| Tabell                                        | Avgränsning och funktion                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `clubs`                                       | Föreningar; synliga genom egna lagmedlemskap, ger inga behörigheter i andra lag.                                                     |
| `teams`                                       | Tillhör en förening. Har eget namn, exakt hemmalagsnamn i Swehockey och flaggan `sync_enabled`.                                      |
| `team_competitions`                           | Lagets tävlings-ID och typ `serie`/`dm`. Inga hårdkodade tävlingsbegränsningar i databasen.                                          |
| `profiles`                                    | Ett **medlemskap per användare och lag**, primärnyckel `(team_id, id)`. Roll, godkännande och familjekoppling gäller bara detta lag. |
| `families`                                    | Lagägda familjer med spelar-/familjenamn och behörighet för OVR, klocka och speaker. Namn är unika inom laget.                       |
| `matches`                                     | Primärnyckel `(team_id, id)`, där `id` är `competition:source_id`. Datum är aldrig identitet.                                        |
| `assignments`                                 | Unik plats `(team_id, match_id, role)`. Sammansatta foreign keys kräver att match och familj tillhör samma lag.                      |
| `instructions`                                | Privata hallinstruktioner, separata per lag.                                                                                         |
| `sync_logs`, `match_changes`, `sync_requests` | Lagägda loggar, ändringshistorik och manuella startbegäranden.                                                                       |
| `assignment_types`                            | Gemensam, icke personrelaterad lista med sex uppgiftsplatser. Ingen klient får ändra listan.                                         |

En användare kan vara ADMIN i lag A, FÖRÄLDER i lag B och sakna åtkomst till lag C, även om lagen tillhör samma förening. Godkännande i ett lag gäller inte i ett annat. Lagadministratörer kan inte skapa föreningar/lag, ändra källkonfiguration eller ge sig själva tillgång till andra lag. Den initiala provisioneringen gör projektägaren i SQL Editor.

Föräldrar läser bara godkända lags uppgifter och får inte ändra bemanningen. Administratörer redigerar endast sina lag. RLS och RPC-funktionerna kontrollerar medlemskap i databasen; klientens filter är inte en säkerhetsgräns. `team_id` kan inte flyttas på befintliga rader. Familjekopplingar över laggränsen stoppas dessutom av foreign keys.

**Aktuell frontendinstallation visar ett valt lag via `VITE_TEAM_ID`.** Flera installationer kan använda samma Supabase-projekt med olika lag-ID. Databasen stöder flera medlemskap per användare, men denna MVP har ännu ingen lagväljare i gränssnittet. Lag-ID är offentlig konfiguration, inte en hemlighet eller en behörighet.

## 1. Förbered ett nytt, tomt Supabase-projekt

1. Använd det nya projektet Seket och välj lämplig databasregion. Skapa inte manuella kopior av appens tabeller i Table Editor.
2. Låt **Automatically expose new tables** vara **avstängd**. Du behöver inte aktivera den.
3. Data API behöver vara aktiverat och `public` behöver ingå bland dess exponerade scheman. Detta är en annan inställning än automatiska rättigheter till nya tabeller. `private` ska **inte** läggas till bland exponerade scheman.
4. Öppna SQL Editor och kör hela `supabase/migrations/001_initial.sql` en gång. Kör därefter hela `supabase/migrations/002_manual_import.sql` en gång. Båda har en egen transaktion med `begin`/`commit`. Hoppa inte över rättighetsdelen i slutet av filerna.
5. Alternativt kan en projektägare använda Supabase CLI med en granskad projektlänkning och `supabase db push`. Det kör externa ändringar och har inte gjorts som del av denna lokala granskning.

Migrationerna ger **explicita, objektspecifika** rättigheter:

- `anon`: ingen läs-/skrivrätt till apptabeller eller appens RPC-funktioner.
- `authenticated`: `SELECT` på angivna tabeller med RLS. Skrivrätt till familjer, instruktioner och bemanning begränsas av lagets adminpolicy. Medlemskap kan bara uppdateras i kolumnerna `role`, `approved`, `family_id`, eller tas bort av lagadministratören. Inga direkta medlemskapsinlägg tillåts.
- `service_role`: explicit `SELECT` på lag och tävlingskonfiguration, `INSERT` på synkloggar och `EXECUTE` på `sync_matches(uuid, jsonb)`. Det räcker för synkscriptet även utan standardgrants.
- RPC-funktioner har explicit `EXECUTE`; privata hjälpfunktioner är inte tillgängliga för API-roller. Ingen funktion förlitar sig på automatisk funktionsåtkomst.

UUID används utan sekvenser, så inga sekvensgrants behövs. Projektets globala default privileges ändras inte. `GRANT SELECT ON ALL TABLES ...` eller bred `GRANT ALL` behövs inte och ska inte användas för att lösa åtkomstproblem.

Supabase beskriver skillnaden mellan GRANT och RLS här: [automatiska tabellrättigheter och explicita grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). Om API svarar `42501 permission denied` ska du kontrollera att båda migrationerna körts helt och att rätt roll används, i stället för att öppna tabeller för `anon`.

## 2. Skapa första föreningen och laget

Kör följande **manuellt i projektets SQL Editor efter migrationerna**. Detta är provisioneringsexempel, inte seeddata som körs automatiskt. Välj namn som passar er förening. `home_team` måste exakt motsvara hemmalagsnamnet i Swehockey.

```sql
begin;

with new_club as (
  insert into public.clubs (name)
  values ('Team Söderort')
  returning id
)
insert into public.teams (club_id, name, home_team)
select id, 'U16F', 'Team Söderort(FOC/THH)'
from new_club
returning id, name, home_team;

commit;
```

Spara lagets returnerade UUID. Ersätt `LAGETS_UUID` nedan med det verkliga värdet:

```sql
insert into public.team_competitions (team_id, competition, kind)
values
  ('LAGETS_UUID'::uuid, '21495', 'serie'),
  ('LAGETS_UUID'::uuid, '22208', 'dm');
```

Dessa två tävlings-ID kommer från de tidigare angivna schemana. Kontrollera dem inför en ny säsong. För andra lag väljer du deras verifierade tävlingar och exakta hemmalagsnamn. För ytterligare lag i samma förening återanvänder du föreningens `club_id`; det ger inte laget tillgång till syskonlagens uppgifter.

`sync_enabled` är medvetet `false` vid skapande. Låt den vara av tills källkonfiguration och synkhemligheter har kontrollerats.

## 3. Koppla frontend och Auth

Kopiera `.env.example` till `.env.local` och fyll i:

```dotenv
VITE_SUPABASE_URL=https://DITT-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=DIN_PUBLIKA_ANON_NYCKEL
VITE_TEAM_ID=LAGETS_UUID
VITE_BASE_PATH=/
```

Starta om Vite efter ändringar. Använd en publik klientnyckel, aldrig `service_role` i frontend. `VITE_TEAM_ID` måste vara det provisionerade lagets UUID.

I Supabase Authentication:

1. Aktivera e-postinloggning och konfigurera fungerande e-postleverans för riktiga föräldrar.
2. Sätt **Site URL** till frontendens adress, till exempel `https://DITT-NAMN.github.io/hockey-app/`.
3. Lägg exakt denna adress i tillåtna Redirect URLs. För lokal utveckling lägger du också till `http://127.0.0.1:5173/`.
4. Logga in i appen med en engångslänk. Appen anropar `request_team_access(p_team_id)` och skapar ett **icke godkänt föräldramedlemskap endast i valt lag**. E-post hämtas från Auth i databasen; klienten får inte ange roll, godkännande eller någon annans användar-ID.

En begäran ger bara tillgång till eget medlemskap och minimal lag-/föreningsinformation. Matcher, familjer, bemanning och instruktioner förblir stängda tills administratören godkänt medlemskapet. Ingen Auth-trigger tilldelar globala roller eller automatiskt lägger nya användare i alla lag.

## 4. Skapa första administratören i just det laget

Identifiera ditt eget verifierade konto i SQL Editor:

```sql
select id, email from auth.users;
select team_id, id, email, approved, role from public.profiles;
```

Ersätt båda UUID-platshållarna innan du kör följande. Det fungerar även om Auth-kontot skapades innan appmigrationerna:

```sql
insert into public.profiles (team_id, id, email, role, approved)
select 'LAGETS_UUID'::uuid, id, email, 'ADMIN', true
from auth.users
where id = 'DITT_VERIFIERADE_ANVÄNDAR_UUID'::uuid
on conflict (team_id, id) do update
set role = 'ADMIN', approved = true
returning team_id, id, role, approved;
```

Kontrollera att exakt ett medlemskap för rätt lag returneras. Uppdatera appen. ADMIN gäller endast detta medlemskap; samma konto behöver separat godkännande i andra lag. Behåll minst en godkänd administratör per lag. Frontend hindrar att du själv återkallar/degraderar ditt aktuella konto.

## 5. Föräldrar och familjekopplingar

Be föräldrar logga in på **rätt lags frontend**. De visas då i det lagets administrativa kö. En inbjudan via e-post skapar inte godkännande; mottagaren behöver följa länken och begära åtkomst i laget. Under Administration väljer du familj, roll och Godkänn. Två vuxna kan kopplas till samma familj i samma lag och ser då familjens pass.

Namnen i Excel avser spelare/familjer. Vuxnas identitet och koppling kan inte härledas ur filen och får aldrig gissas. Återkalla medlemskap per lag när en person inte längre ska ha åtkomst. Återkallelse påverkar inte ett annat lags medlemskap.

## 6. GitHub Pages och schemalagd synk

Repo: `https://github.com/sarakluge/hockey-app` (privat). Privat repo kräver att ditt GitHub-konto har stöd för Pages för den typen av repo. Källkoden är pushad sedan tidigare; dessa nya databasändringar har inte automatiskt publicerats.

I GitHub **Settings → Secrets and variables → Actions**:

- Repository **Variables** för frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, **`VITE_TEAM_ID`**.
- Repository **Secrets** för serverjobbet: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Hemliga nycklar får aldrig prefixas `VITE_`, läggas i Git eller delas i chatten. `deploy.yml` testar och bygger frontend. Aktivera GitHub Actions som Pages-källa när ni vill publicera. Vite base path sätts till repo-namnet; för egen domän/rotwebbplats används `/`. Hash-routing kräver inga serveromskrivningar.

När synkningen är förberedd aktiverar projektägaren respektive lag:

```sql
update public.teams
set sync_enabled = true
where id = 'LAGETS_UUID'::uuid;
```

Workflow **Synkronisera hemmamatcher** kör vid minut 17 var sjätte timme i UTC. Manuell `workflow_dispatch` har valfritt `team_id`: ifyllt UUID kör ett valt synkaktiverat lag, tomt kör alla synkaktiverade lag. I lokal servermiljö motsvarar detta variabeln `SYNC_TEAM_ID`. Kör inte serverns synkscript mot produktion som ett lokalt test.

Synken läser lag och tävlingar ur databasen. Samma tävlingssida återanvänds inom körningen om flera lag använder den. Varje lag uppdateras i en separat transaktion och advisory lock; ett fel i lag A rullar tillbaka A men hindrar inte B från att synkas. Inga lag finns eller aktiveras automatiskt. Ett urval utan synkaktiverade lag rapporteras som ett konfigurationsfel.

Alla lagets konfigurerade tävlingar måste lämna minst en verifierad hemmamatch för att full synk ska skriva data. Tomt/ändrat format, fel hemmalag eller saknad tävling avbryter uppdateringen. Det är en försiktighetsgräns: en tävling som verkligen saknar hemmamatcher behöver hanteras med verifierad manuell import eller korrigerad konfiguration, inte genom att tyst tömma schemat. Försvunna matcher flaggas endast inom aktuellt lag; bemanningen behålls. Ändringshistorik, senaste lyckade synk och felmeddelanden är också lagseparerade.

`service_role` är betrodd infrastruktur och kringgår Supabase RLS. Den får därför finnas endast i serverjobbet. Frontendanvändare kan inte anropa service-synken, även om de är lagadministratörer. Servern skickar alltid ett explicit `p_team_id`.

### Starta synken via appen

Supabase Edge Function `dispatch-sync` kontrollerar sessionen och `is_admin(p_team_id)`, begränsar begäranden per lag till en var femte minut och startar GitHub-workflow med **samma lag-ID**. Den kan inte användas av en administratör för att starta ett annat lags synk.

Konfigurera vid framtida driftsättning:

- `GITHUB_DISPATCH_TOKEN`: GitHub fine-grained token endast för detta repo, med Actions Read and write.
- `GITHUB_REPOSITORY`: `sarakluge/hockey-app`.
- `APP_ORIGIN`: frontendens origin utan sökväg, exempelvis `https://DITT-NAMN.github.io`. För lokal funktionstestning använder du rätt lokal origin. Nuvarande funktion har en konfigurerad origin; flera olika domäner behöver en granskad allowlist i en framtida utbyggnad.

Projektägaren kan sedan deploya funktionen med Supabase CLI (`supabase functions deploy dispatch-sync`) efter inloggning och kontrollerad projektlänkning. Ingen funktion har deployats av denna granskning. Alternativt kan en repoansvarig alltid starta workflow från GitHub.

## Excel-import och rättvis fördelning

Kör en lyckad synk eller manuell matchimport för **aktuellt lag** först. Välj sedan en privat kopia av Excel-filen i Administration. Appen läser schema, spelar-/behörighetslista och hallinstruktioner lokalt i webbläsaren. Högst 5 MB; originalet laddas inte upp eller ändras.

Förhandsvisningen föreslår matchning utifrån datum och exakt motståndare men kräver att varje rad kontrolleras mot tävling, matchnummer, tid och arena. Oklara matchningar måste väljas manuellt. Samma match kan inte väljas för flera Excel-rader. Familjer matchas efter exakt namn **inom valt lag**. Granska även instruktionerna; de kan innehålla privata koder.

Godkänn uttryckligen personuppgifterna före sparande. RPC `import_excel(p_team_id, p_data)` kontrollerar lagets administratör, matchkopplingar och uppgiftsbehörigheter. Importen är atomisk och upprepning av samma data skapar inga dubletter. Befintlig motstridig bemanning avbryter hela importen. Behörighetsflaggor/instruktioner uppdateras från den godkända filen. Ett lags import rör inte ett annat lags familjer med samma namn.

Alla sex platser väger lika. Båsdörr 1 och 2 summeras tillsammans. OVR, klocka och speaker kräver Ja-flaggor. Inga vikter, kvoter eller tysta undantag har hittats i originalet. Vissa ursprungliga uppdrag motsvarar inte behörighetsflaggorna; rätta vid behov en privat kopia i samråd med laget. Flera uppgifter till samma familj behöver flera tillgängliga vuxna. Statistiken räknar alla lagets importerade tilldelningar, inte arbetade timmar eller endast en vald säsong.

## Manuell matchimport vid källproblem

Administration → Manuell matchimport. Klistra in en lista av verifierade matchobjekt och bekräfta källkontrollen. **Detta är en mall med platshållare**, inte verkliga matchdata:

```json
[
  {
    "id": "TÄVLINGSNUMMER:OFFICIELLT_MATCHNUMMER",
    "competition": "TÄVLINGSNUMMER",
    "source_id": "OFFICIELLT_MATCHNUMMER",
    "starts_at": "ÅÅÅÅ-MM-DDTHH:MM:00+01:00",
    "home_team": "LAGETS_EXAKTA_HEMMALAGSNAMN",
    "away_team": "VERIFIERAT_MOTSTÅNDARLAG",
    "arena": "VERIFIERAD_ARENA",
    "status": "scheduled",
    "needs_review": false
  }
]
```

Match- och tävlingsnummer måste vara numeriska och tävlingen måste vara konfigurerad för laget. `source_id` är det stabila matchnumret i matchtidens tooltip, inte `/Game/Events/...`-länkens ID. Tider behöver explicit tidszon, `+01:00` vintertid och `+02:00` sommartid i Stockholm, eller UTC `Z`. Använd `starts_at: null` och `needs_review: true` för obekräftad tid. Status är `scheduled`, `finished`, `postponed` eller `cancelled`.

RPC `manual_matches(p_team_id, p_matches)` kan bara köras av administratör i valt lag. Den bevarar bemanning, loggar ändringar och markerar inga andra matcher som saknade. Nästa lyckade synk återställer källans uppgifter. Manuella importer räknas inte som lyckad automatisk synk. JSON-export från appen omfattar bara det laddade lagets data och ska förvaras privat.

## Testning och kvarvarande verifiering

`npm test` kör både rena funktionstester och migrationerna i lokal PostgreSQL via PGlite. Databastestet skapar ett tomt schema med API-roller, utan standardgrants på tabeller och utan standard-EXECUTE på funktioner. **Inga extra testgrants läggs till för att få appen att fungera.** Ett separat sluttest breddar sedan rättigheterna avsiktligt för att kontrollera RLS som ytterligare skydd.

Testfallen täcker tre lag i två föreningar, olika roller per lag för samma användare, väntande/obehöriga konton, explicita servicegrants, samma familjenamn/matchnyckel i olika lag, nekad skrivning och RPC i fel lag, sammansatta foreign keys, behörighetsflaggor, atomisk/idempotent import, lagseparerad rate limit samt flyttade/försvunna matcher utan förlorad bemanning.

Webbläsarkontroll med fiktiva data: starta Vite och kör `node scripts/browser-check.mjs`. Den använder befintlig Chrome på macOS, eller sökvägen i `CHROME_PATH`, och kontrollerar tre flikar, matchfilter, bemanning, pass, info och fyra skärmbredder. Axe kontrollerar även automatiskt testbara WCAG 2.1 AA-regler i huvudvyerna och integritetsdialogen; Escape-stängning och återställt fokus verifieras. Detta ersätter inte manuell tillgänglighetsgranskning. Skärmbilder läggs i `/tmp`.

PGlite ersätter inte Supabase Auth eller PostgREST. Inställningen Automatically expose new tables verifieras lokalt genom PostgreSQL-rättigheter, inte via ett anrop till ert riktiga projekt. Verkliga engångslänkar, PostgREST/exponerade scheman, Edge Function, GitHub-secrets och publicering måste senare kontrolleras av projektägaren i rätt miljö. Ingen skarp synk, SQL-körning, import eller publicering har gjorts i denna uppgift.

## Integritet och radering

- Ange lagets ansvariga kontakt, lagringsperiod och gallringsrutin i integritetstexten före föräldralansering.
- Återkalla godkännande i rätt lag. RLS prövar godkännandet på nytt även om användaren har en tidigare utfärdad session. Redan nedladdade/exporterade uppgifter går inte att återkalla.
- Radera enbart `(team_id, id)` i `profiles` för att ta bort ett lagmedlemskap; övriga lag påverkas inte.
- Radering av ett Auth-konto i Supabase Authentication tar bort **alla** användarens lagmedlemskap. Gör det bara om hela kontot ska bort, inte vid utträde ur ett enskilt lag.
- Radering av en verifierad familjerad tar bort dess tilldelningar och sätter bara `family_id` till null i medlemskapen. Familjer i andra lag påverkas inte.
- Hela föreningar/lag och tävlingar har restriktiva relationer för matchhistorik. Radera dem inte som en genväg för gallring; planera en separat, verifierad gallring av historiken.
- Synkloggar innehåller ingen e-post/bemanning. `match_changes` lagrar matchuppgifter, och användarreferensen i `sync_requests` sätts till null vid Auth-radering. Hantera även privata Excel-kopior, exporter och databasbackuper enligt gallringsrutinen.

## Kod och formatering

- `src/App.tsx`: appskal och navigation.
- `src/pages/`, `src/components/`: lagets vyer, import och formulär.
- `src/hooks/useHockeyApp.ts`: valt lag, medlemskap och lagfiltrerade databasanrop.
- `src/lib/excel.ts`: skrivskyddad import och förhandsvisning; formler exekveras inte.
- `src/lib/swehockey.ts`: strikt HTML-parser med Stockholm-tider.
- `scripts/sync.ts`: lagkonfigurerad serversynk med hemligheter endast i miljön.
- `supabase/migrations/`: fullständiga initialmigrationer, RLS, grants och atomiska RPC-funktioner.
- `supabase/functions/dispatch-sync/`: autentiserad, lagbegränsad workflow-start.

Kör `npm run format` för läsbara radbrytningar/indrag och `npm run format:check` för kontroll. `.editorconfig` och `.prettierrc.json` innehåller inställningarna. SQL-migrationerna är formaterade separat med läsbara block. Redigera aldrig komprimerade byggfiler i `dist/`.

## Komponentbibliotek och tema

Gränssnittet använder **MUI Material UI 9** med Emotion och svensk lokalisering. Temat i `src/theme/theme.ts` samlar färger, typografi, avstånd och komponentinställningar. `ThemeProvider` och `CssBaseline` kopplas in i `src/main.tsx`. Systemtypsnitt används utan externa fontanrop.

Använd MUI:s `Button`, `TextField`, `Card`, `Alert`, `Accordion`, `Dialog`, `Table` och övriga standardkomponenter när gränssnittet byggs vidare. `SelectField` är ett tunt MUI TextField-omslag med native-valmeny för mobil och en synlig, kopplad etikett. Lucide används fortsatt för SVG-ikoner. CSS-filerna innehåller endast appens egna sammansättningar och layout; tidigare Tailwind-beroenden och globala formulärstilar har tagits bort.

Integritetsdialogen använder MUI:s fokuslås och återställer fokus vid stängning. Navigation och ikonknappar har tillgängliga namn; en hoppa-till-innehåll-länk kan nås med tangentbord. Den breda fördelningstabellen är tangentbordsfokuserbar och kan rullas i sidled. Kontrollera fortfarande innehåll, nya flöden, skärmläsning och zoom manuellt; ett komponentbibliotek garanterar inte i sig att appen uppfyller alla riktlinjer.

Administration, informationssidan och Excel-läsning laddas vid behov. MUI och Supabase byggs som separata cachebara paketdelar. Inga databasändringar behövs för MUI-bytet.
