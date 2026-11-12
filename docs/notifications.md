# Pushnotiser för ersättarförfrågningar

Vi börjar med pushnotiser. Inga mejl skickas för ersättarförfrågningar. Supabase Auths vanliga mejl för inloggning och lösenordsåterställning påverkas inte.

När familjens grupp står på tur köas push till varje godkänd förälders registrerade enheter. Besked om ersättare skickas också till berörda familjers enheter. Föräldern aktiverar eller stänger av push under **Min profil → Notiser**. Tillfrågade familjer ser förfrågningarna under Mina pass. Alla godkända familjer kan se öppna förfrågningar på matchkortet under bemanningen, och alla behöriga familjer kan ta passet där utan att ha fått en notis. Familjer får frivilligt ta flera pass på samma match. Familjer som har markerat sig otillgängliga eller är undantagna från bemanning kan inte ta över själva. Ett tidigare ”Kan inte” hindrar inte ett senare övertagande medan sökningen pågår.

## Aktivering

1. Kör migrationerna i ordning: `014_external_notifications.sql`, `015_notification_cron.sql`, **`016_push_only_notifications.sql`**. Har du redan kört 014 och 015 räcker det att köra 016. Tidigare migrationer behålls för kompatibilitet; 016 stoppar väntande mejl och ändrar kön till enbart push. Historik och tidigare inställningar raderas inte. 015 kräver hosted Supabase Vault, `pg_net` och `pg_cron` från migration 007.
2. Generera VAPID-nycklar lokalt:

   ```sh
   npx --package=web-push@3.6.7 web-push generate-vapid-keys
   ```

   Spara den privata nyckeln säkert. Behåll samma nycklar över tid; byte kräver att enheterna registreras på nytt.

3. Sätt dessa **Supabase Edge Function-hemligheter** via dashboard eller CLI:

   | Namn                           | Innehåll                                                                                              |
   | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
   | `APP_URL`                      | Appens hela HTTPS-adress, inklusive `/hockey-app/` om den ligger där                                  |
   | `VAPID_PUBLIC_KEY`             | Publik VAPID-nyckel                                                                                   |
   | `VAPID_PRIVATE_KEY`            | Privat VAPID-nyckel                                                                                   |
   | `VAPID_SUBJECT`                | Kontaktadress, t.ex. `mailto:admin@din-domän.se`. Används som kontakt för push, inte för mejlutskick. |
   | `NOTIFICATION_DISPATCH_SECRET` | Ett slumpmässigt långt serverlösenord, t.ex. genererat med `openssl rand -hex 32`                     |

   `SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` tillhandahålls av Supabase. Privata värden får inte ligga i Git eller i `VITE_*`. Resend och avsändardomän behövs inte. Gamla `RESEND_API_KEY` och `NOTIFICATION_FROM` används inte av den nya funktionen.

4. Publicera den uppdaterade serverfunktionen:

   ```sh
   supabase functions deploy dispatch-notifications --no-verify-jwt
   ```

   Flaggan är avsiktlig: funktionen kontrollerar det separata serverlösenordet innan kön läses. Vanliga användartoken ger ingen åtkomst till utskicken. Om en äldre mejlversion redan är publicerad ska den ersättas med denna version.

5. Skapa två hemligheter i **Supabase Vault** via dashboard:

   | Vault-namn                     | Innehåll                                                               |
   | ------------------------------ | ---------------------------------------------------------------------- |
   | `notification_dispatch_url`    | `https://DITT-PROJEKT.supabase.co/functions/v1/dispatch-notifications` |
   | `notification_dispatch_secret` | Samma värde som `NOTIFICATION_DISPATCH_SECRET`                         |

6. Sätt **GitHub Actions repository variable** `VITE_VAPID_PUBLIC_KEY` till den publika VAPID-nyckeln och bygg/publicera frontend igen. Lokalt sätts samma variabel i `.env.local` och utvecklingsservern startas om.
7. Föräldern öppnar **Min profil → Notiser** och aktiverar push på varje önskad enhet. På iPhone/iPad behöver appen först läggas till på hemskärmen och öppnas därifrån. Manifest och service worker fungerar även under `/hockey-app/`.

## Kontroll

- Använd godkända testkonton och en kommande testmatch. Starta en ersättarsökning från en annan familj. Kontrollera att push kommer först när testfamiljens grupp aktiveras.
- Prova på en riktig iPhone hemskärmsapp och Android även när appen är stängd. Klick på notisen ska öppna **Mina pass**; inloggning krävs om sessionen har gått ut.
- Prova avstå, nästa grupp och acceptans. Avslutade förfrågningar ska hoppas över före utskick, och berörda familjer ska få besked när någon tar över.
- Stäng av push på enheten och kontrollera att inga nya notiser skickas dit. Två föräldrar till samma spelare kan aktivera sina egna enheter separat.

## Kö och felsökning

Cron kontrollerar kön varje minut. Leverans kan dröja ungefär en minut eller längre vid kö eller leverantörsfel. Bemanningen och acceptansen fungerar oberoende av notisleveransen.

Projektägaren kan inspektera `notification_deliveries`: `queued`, `sending`, `sent`, `skipped`, `failed`. `sent` betyder att pushleverantören accepterat meddelandet, inte att föräldern läst det. `last_error` visar generell felstatus. Kontrollera även Cron och Edge Function-loggar.

Arbetaren tar högst tio utskick åt gången, med fem minuters låsning per försök. Fel får upp till sex försök med ökande väntetid. En stabil tagg per sökning ersätter dubbla notiser på enheten, men exakt en leverans kan inte garanteras vid avbruten bearbetning. Utgångna prenumerationer tas bort vid HTTP 404/410.

Medlemskap, familjekoppling och förfrågans aktualitet kontrolleras igen vid hämtning ur kön. Förfrågningar efter deadline, passerad match eller avslutad sökning hoppas över. Utskick äldre än 23 timmar hoppas också över. Historiska meddelanden backfylls inte vid installation: nya gruppaktiveringar skapar nya utskick. Redan levererade notiser kan inte återkallas; appen visar aktuell status när de öppnas.

Saknas pushkonfiguration hämtas inga utskick och inga återförsök förbrukas. Stoppa utskicksjobbet vid behov med `select cron.unschedule('dispatch-replacement-notifications');`. Ersättarsökningarnas egen cron påverkas inte.

## Referenser

- [Supabase Cron och Vault](https://supabase.com/docs/guides/functions/schedule-functions)
- [Web Push på iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [web-push](https://github.com/web-push-libs/web-push)

## Öppna förfrågningar på matchkortet

Kör `017_open_replacement_acceptance.sql` före publicering av den uppdaterade frontendversionen. Migrationen öppnar övertagande för behöriga familjer; gruppindelning och pushutskick behåller sin turordning. Endast aktivt tillfrågade familjer kan svara ”Kan inte”. Övertagandet bekräftas i appen och kontrolleras atomärt i databasen, så bara en familj kan ta passet. Avslutade sökningar öppnas inte igen.

Kör därefter `018_voluntary_multiple_shifts.sql` för att tillåta flera frivilliga övertaganden på samma match. Den automatiska bemanningen och urvalet för riktade förfrågningar påverkas inte. Har 017 redan körts räcker det att köra 018.
