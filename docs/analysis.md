# Analys av original och datakälla

Analysdatum: 2026-11-05. Originalet lästes som ZIP/XML utan skrivning. Personnamn, koder eller råa arbetsboksutdrag sparas inte i projektet.

## Arbetsbok

1. **Seketschema U16F**: åtta matchrader, kolumner Matchdatum, Arena, Gästande lag, Båsdörr1, Båsdörr2, OVR, Klockan, Speaker/Musik, Matchvärd. En rad saknar fast datum. En plats saknar bemanning. Samma familj förekommer i flera platser vid en match, vilket kräver mänsklig kontroll av tillgängliga vuxna.
2. **Seket - Förberedelser & Avslut**: hallspecifika instruktioner för Farsta och Fontana, före och efter match, för OVR, klocka, speaker/musik och båsdörr. Dessa kan innehålla åtkomstkoder. De visas enbart privat efter godkänd import.
3. **Lathund för anteckningar OVRSpe**: endast rubriker Tid, Spelarnummer, Spelarnamn, Vad, Lag. Inga ytterligare instruktioner eller ifyllda anteckningar hittades.
4. **Spelare och fördelning**: femton spelare/familjer, rollräkningar, total, Ja/Nej för OVR/klocka/speaker och filtrerade listor.

COUNTIF-formler räknar båsdörrens två kolumner tillsammans; övriga roller var för sig. Totalen är summan av fem rollgrupper. FILTER-listor väljer rader vars behörighetskolumn är Ja. Inga vikter, kvoter, undantagslistor, frånvaroregler eller automatiska fördelningsalgoritmer hittades. Tom behörighetscell behandlas inte som Ja. Vissa befintliga uppdrag stämmer inte med behörighetslistorna; appen ger ingen tyst dispens. Flera vuxna kan kopplas till samma familj, men dessa relationer kan inte utläsas ur Excel och måste administreras manuellt.

Formlerna refererar till schemaområde rad 2–22; endast åtta matchrader är ifyllda. Appen räknar alla faktiskt importerade tilldelningar, utan Excels områdesbegränsning.

Kombinationen hallar, motståndare och instruktionernas lagreferenser identifierar **Team Söderort(FOC/THH)**. Detta namn förekommer som hemmalag i de angivna officiella schemana.

## Swehockey

Verifierade med HTTP-hämtning från utvecklingsmiljön:

- https://stats.swehockey.se/ScheduleAndResults/Schedule/21495 — sex hemmamatcher vid analystillfället.
- https://stats.swehockey.se/ScheduleAndResults/Schedule/22208 — två hemmamatcher vid analystillfället.

Schemat finns direkt i serverrenderad HTML under `#groupStandingResultContent .tblContent`. Inga extra privata anrop behövs. Tooltip `title` på `.dateLink .lnkTooltip` innehåller matchnumret även före spelad match. Länkar till `/Game/Events/...` använder andra ID och finns inte för alla framtida matcher; de används inte som primärnyckel.

Datum kan saknas på följande rader samma dag och måste ärvas från föregående datumrad. Responsiva HTML-celler duplicerar datum/tid; parsern utgår därför från tooltipens cell och dess efterföljande lag-/resultatceller. Arena hämtas från sista cellen.

Tiden `00:01` förekommer för en match som i Excel väntar på ny tid. Appen visar obekräftad tid, sparar `starts_at=null` och `needs_review=true` i stället för att presentera detta som en faktisk nattmatch. `00:00` hanteras på samma sätt. Detta är en uttrycklig försiktighetsregel; källan anger ingen dokumenterad generell betydelse för dessa tider.

Inget dokumenterat publikt API hittades vid kontrollen. `/robots.txt` svarade 404. Detta ger ingen generell licens eller garanti för automatiserad återanvändning. Ingen tydlig särskild åtkomstregel identifierades i det kontrollerade materialet. Återkommande hämtning är ännu inte aktiverad. Vid nya åtkomstvillkor, avvisning eller begäran från källägaren ska automatiken pausas och den manuella reservlösningen användas. Scriptet hämtar bara två sidor var sjätte timme, använder identifierande User-Agent och gör inga aggressiva återförsök. Det passerar inte CAPTCHA, autentisering eller andra åtkomstskydd.

Matcher filtreras med exakt hemmalagsnamn. Tomt eller nytt HTML-format stoppar synken innan databasskrivning. Båda schemana måste lyckas. SQL-funktionen serialiserar synk/import och utför hela uppdateringen atomiskt. Ändrade matcher loggas och får `changed_at`. Försvunna match-ID flaggas; ingenting raderas. Återkomst tar bort saknas-flaggan. Bemanning är en separat relation till stabilt match-ID.

Säsong och tävlings-ID behöver kontrolleras inför nästa säsong. UI och workflow är förberedda för de två uttryckligen angivna tävlingarna, inte ett automatiskt säsongsbyte.

## Kvar att verifiera externt

Supabase Auth, e-postleverans, verkliga RLS-anrop via Supabase API, Edge Function, GitHub-token, schemalagda Actions och Pages-publicering behöver provas i ägarens egna konton. Lokal byggning, lokal PostgreSQL med RLS och webbläsarflöden kan testas utan dem. Inga riktiga personuppgifter ska importeras förrän administratören uttryckligen godkänner förhandsvisningen.
