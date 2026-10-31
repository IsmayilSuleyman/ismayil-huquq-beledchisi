# Summarising Constitutional Court decisions — the method

This is the method the daily routine follows (`scripts/summaries/ROUTINE.md`
says when and how to run it). It was reconstructed from Elgun Jafarov's
"new decision" emails: 32 of them, June 2023 to June 2026, each compared
against the full text of the decision on constcourt.gov.az. Sections 2 to 8
are the algorithm in the order the work is done, section 9 is the
checklist, the appendices hold the evidence and a worked example.

**What changes here.** The method was written for an email; the routine
produces a page on the gazette site (`/summaries/<id>`) and a Word file
with the firm's header, both generated from one JSON draft
(`scripts/summaries/draft.ts`). So:

- **No email frame.** No "Dear all", no "New decision of the Constitutional
  Court was adopted", no "I am adding the Court's important positions
  below", no "Regards". The layout adds the decision's name, date and
  link, the topic line and the "AI-generated" notice by itself.
- **The topic line** goes in `topic`, in English, without the "Topic --"
  prefix (the layout prints it).
- **The bullets** go in `blocks[].bullets[].text`, verbatim, with the
  emphasis written as marks: `**bold**`, `__underline__`, `*italic*`,
  nestable (`**__both__**`). A decision's own sub-list goes in `sub`, one
  string per item. A decision with two or three distinct questions gets
  one block per question, each with its own `heading` in Azerbaijani
  ("(A) İlkin müqavilə üzrə ödəniş edilməsinin mümkünlüyü").
- **Everything else** (steps 0 to 5, section 9's checks) applies as
  written. "Email" below means the summary.

---

## The original instruction

*A thinking algorithm reconstructed from his 32 "new decision" emails (June 2023 to June 2026), each compared against the full text on constcourt.gov.az*

Prepared for İsmayıl Süleyman, OMNI Law Firm, 31 October 2026

# 1. What this document is

Elgun Jafarov circulates a short email after selected Plenum decisions of the Constitutional Court. Each email has the same shape: a link, an English topic line, and a handful of Azerbaijani passages copied from the decision with underlining and bold. This document turns his practice into a procedure that can be followed step by step and produces the same kind of email.

Basis. All 31 Constitutional Court emails in the chain (plus one Supreme Court email) were matched to the current text of the decision on the Court's site (the site re-numbered its pages, so his old links are dead; the mapping is in Appendix A). For each email every bullet was located in the full text, every edit he made was listed, and everything he left out was classified. The 61 Plenum acts of the same period that he did not circulate were also reviewed to work out the selection filter (Appendix B). Nine borderline skipped decisions were read in full.

How to use it. Sections 2 to 8 are the algorithm, in the order the work is done. Section 9 is the checklist. The appendices hold the evidence and a worked example. Where his own practice is inconsistent, the rule says which variant to follow and why.

# 2. Step 0: decide whether the decision gets an email at all

He circulated about a third of what the Plenum published in the period (31 of 89 acts between June 2023 and June 2026). The filter is subject matter, not the form of the act and not who initiated it.

## 2.1 What passes

A decision passes when it states a rule that a corporate or commercial client, or a litigator acting for one, would use. In practice that meant: contract law (form of transactions, preliminary contracts, sham transactions, loans, leases, gifts, success fees, estoppel), property and registration (grounds for registration, state register, construction in progress), limitation and preclusive periods, damages and indexation, civil procedure and enforcement (cassation, limitation as a defence, legally protected interest, notary execution records, bank liquidation), labour law seen from the employer's side (fixed-term contracts, deductions from salary, director versus company, branches as parties, severance and tax), tax and foreign exchange rules affecting companies, administrative contracts and legitimate expectations in administrative procedure, and corporate exposure to criminal or administrative sanctions (criminal measures against legal entities, the carrier concept, intermediation in foreign currency).

Both forms of act pass: 23 of the 31 are Qərar and 8 are Qərardad (rulings that close the case because the matter can be resolved on the existing law). What matters is whether the text contains usable positions, not the label. Nearly all are referrals by a court (Bakı Apellyasiya Məhkəməsi, Ali Məhkəmə) asking for interpretation; individual complaints pass only when the Court states general rules on the way to the result (estoppel in M.Şükürov; gift form in E.Salmanlı; cassation re-filing in Azəri-K).

## 2.2 What does not pass

Criminal law and criminal procedure (about 40 of the 61 skipped acts), administrative offences unless the offender is a business, elections and the Milli Məclis, military service, education, pensions and social benefits, migration, family law, succession and inheritance, housing disputes between neighbours, individual complaints about access to court with no general rule, and prosecution or court-organisation matters.

## 2.3 Borderline cases and the rule to apply

Six skipped decisions had clear business relevance and no obvious subject-matter reason for the omission: property tax on collateral a bank takes after a failed auction (26.07.2023), the limitation period for compulsory-insurance claims of a business (03.04.2025), compensation for unused additional leave on termination, payable by every employer (18.02.2026), a legal entity operating from a residential flat (23.06.2026), AML duties of accounting and advisory firms (25.06.2026), and the inspection moratorium (13.10.2026, after the test decision). The filter is therefore applied loosely at the edges. The rule to follow: pass the decision if the answer to "would any of our clients or our litigators change what they do because of this?" is yes. Under that test all six should have been circulated.

## 2.4 Timing and cadence

One email per decision, never a batch. Sent 2 to 14 days after the decision date in most cases (loan decision: 2 days; carrier: 4 days; preliminary contract: 9 days), occasionally later (legitimate expectations: 51 days). When the Court's site had not yet posted the text he linked e-qanun.az instead (30.09.2024 ruling, sent 3 days later). He also circulates, rarely, a Supreme Court Plenum ruling on uniformity of practice in the same format (14.05.2025).

# 3. Step 1: read the whole decision and map it

Every Plenum decision has the same anatomy. Map it before choosing anything, because the selection rules in step 3 are defined by these parts.

1.  Header: "AZƏRBAYCAN RESPUBLİKASI ADINDAN", title, date and place, composition, the legal basis of the hearing, the list of opinions and experts, then "MÜƏYYƏN ETDİ:". Never quoted.

2.  Summary of the request: paragraphs beginning "Müraciətdə qeyd edilir ki", "Müraciətedən hesab edir ki", "Belə ki, bəzi hüquq tətbiqedənlərin mövqeyinə əsasən". For complaints, the facts and procedural history. Never quoted, with one exception (see 5.2).

3.  Transition: "Konstitusiya Məhkəməsinin Plenumu müraciətlə əlaqədar aşağıdakıları qeyd edir" or "...ilk növbədə qeyd edir ki".

4.  Constitutional recitals and general principles: "Konstitusiyanın 13-cü maddəsinin I hissəsinə əsasən", "hüquqi müəyyənlik prinsipi", proportionality, ECtHR cases. Never quoted.

5.  Earlier positions of the Court: sentences ending in "(... tarixli Qərar)" or beginning "Konstitusiya Məhkəməsi Plenumunun ... hüquqi mövqeyinə görə". Never quoted; the bracketed citation is removed even when the surrounding sentence is taken.

6.  Statutory restatements: "Mülki Məcəllənin 402.1-ci maddəsinə görə ...". Quoted only when the statute itself is the rule the email needs (see 5.1).

7.  The Court's own reasoning: paragraphs that start "Konstitusiya Məhkəməsinin Plenumu hesab edir ki / qeyd edir ki / vurğulayır", "Göründüyü kimi", "Beləliklə", "Odur ki", "Bu baxımdan", "Nəzərə alınmalıdır ki", "Vurğulanmalıdır ki", "Bununla belə". This is where almost everything he quotes comes from.

8.  Conclusions: "Göstərilənlərə əsasən Konstitusiya Məhkəməsinin Plenumu aşağıdakı nəticələrə gəlir:" followed by dash paragraphs ending in "-məlidir", "tövsiyə olunmalıdır", "şamil edilməlidir". His second main source.

9.  Legal-basis sentence and "QƏRARA ALDI:" with numbered points ("tövsiyə olunsun", "hesab edilsin", "şamil edilsin"), then entry into force, publication, finality. Used only in the cases listed in 5.4. In a Qərardad the operative part is "hüquqi mövqelər nəzərə alınsın" and "icraatına xitam verilsin"; never quoted.

While reading, number the Court's own paragraphs (R1, R2, ...) and tag each one with what it does: FACT, CONST (constitutional recital), CITE (earlier decision, ECtHR, foreign law, doctrine), STAT (statute restated), WHY (explanation, policy, history), RULE (a general proposition of law), DEF (definition), TEST (criteria or elements a court must examine), ANSWER (the sentence that answers the question put), REVERSAL (practice declared wrong: "yanlış olaraq", "yolverilməzdir"), TRANS (transitional rule: "məsələ qanunvericilik qaydasında həll edilənədək"), TEMP (temporal application: "bu Qərar qüvvəyə mindikdən sonra", "hazırda məhkəmələrin icraatında olan işlərə"), RECOM (recommendation to the Milli Məclis). Only RULE, DEF, TEST, ANSWER, REVERSAL, TRANS, TEMP and RECOM are candidates.

# 4. Step 2: write the topic line

The topic line is the only English in the email and the only thing he writes himself. Format: "***Topic -- ...***" in bold italic (2024 onwards; in 2023 it was "*Topic - ...*" in italic, and once "The subject:"). Rules drawn from the 32 lines:

- Phrase it as the question the referring court asked, in plain English, or as a noun phrase naming the concept the Court interpreted. Examples: "Is the written form requirement for loan agreements exceeding 3,000 AZN a validity requirement or an evidentiary requirement?"; "The concept of "carrier" (daşıyıcı) in the Law "On Motor Transport""; "Where a transaction is deemed a sham, the regime for applying the provisions of the true transaction."

- Keep the Azerbaijani term in brackets where there is no settled English equivalent: ilkin müqavilə, icra qeydi, daşıyıcı, etimad, akseptsiz.

- Two questions in one line are fine when the decision has two blocks ("Is it possible to make payment under the main agreement within the initial agreement (ilkin müqavilə)? Can transactions be concluded in relation to unregistered immovable property?").

- Name the statute by its English name and the article where the question turns on it ("Article 47 (f) of the Labor Code", "Article 102.1.4 of the Tax Code", "Article 405 of the Civil Procedure Code").

- Do not answer the question in the topic line and do not evaluate the decision. No "important", "landmark", no adjectives.

One correction to his practice. Twice the topic line restated the referring court's thesis which the Court then rejected (limitation period "or when the actual defendant is identified", 08.07.2025) or described only the paragraphs he liked rather than the ruling's subject (appellate remand ruling, 04.07.2025). Write the topic as the question the Court actually answered, so that a reader who stops at the topic line is not misled.

# 5. Step 3: choose the passages

This is the core of the method. The pattern across all 31 decisions is stable: he quotes only sentences written by the Court that state something a practitioner could cite, and he cuts everything that explains why. The selection is built around his own topic line; passages answering other questions in the same decision are usually left out.

## 5.1 Include

- The Court's general rules (RULE): "əqdin forması ilə bağlı tələb yalnız qanunda imperativ qaydada, aşkar şəkildə müəyyən edildiyi təqdirdə müvafiq hüquqi nəticələrə səbəb ola bilər".

- Definitions and distinctions (DEF): what a preliminary contract is and is not; relative versus absolute rights; limitation versus preclusive period; real versus consensual contract; administrative versus civil contract.

- Tests, criteria and element lists (TEST): the five features of an administrative contract; the three conditions for criminal measures against a legal entity; the two limbs of estoppel; what a court must examine before rejecting a claim as time-barred. Lists are kept as sub-bullets exactly as in the decision.

- The sentence that answers the topic question (ANSWER), taken from the conclusions block where there is one.

- Express reversals of practice (REVERSAL): "yanlış olaraq ... iflas proseduru çərçivəsində baxılmalı olduğu qənaətinə gəlinir".

- Transitional rules (TRANS) and temporal-application rules (TEMP), always, even when they sit only in the reasoning: "Məsələ qanunvericilik qaydasında həll edilənədək ...", "bu Qərarın qüvvəyə mindiyi tarixdən etibarən ...", "hazırda məhkəmələrin icraatında olan ... işlər üzrə də tətbiq edilməlidir", re-filing rights after terminated proceedings.

- Recommendations to the Milli Məclis (RECOM) when they signal that the rule will change (loan form, registration grounds, cassation period, criminal measures); dropped when the recommendation adds nothing a practitioner can act on (indexation, notary execution record, gift form).

- A statutory restatement only when the statute is itself the rule and the Court's own words add nothing: Labour Code 175(4), Tax Code 2.4-1, Civil Code 406, the Advocates Law on uncapped fees, Annex 1 clause 2.3 on stating the reason for a fixed term. Strip the citation so it reads as a position.

- De lege ferenda signals that affect business, in the Court's own "məqsədəmüvafiqdir" or "vurğulayır" sentences (allotment of state land on a property-right basis; registration of construction in progress).

## 5.2 Exclude

- The request, the facts, the parties, the procedural history, the experts, the opinions of state bodies. The one exception in 32 emails: a single sentence of his own stating the neighbour's extract in the legitimate-expectations ruling, because the equality point is meaningless without it.

- Constitutional recitals, human-rights principles, proportionality, legal certainty in the abstract, the social state.

- Earlier Constitutional Court decisions, ECtHR judgments, foreign law (Türkiyə, Qazaxıstan, Russia, CCBE, Germany), doctrine, Roman law asides. Even when a sentence is kept, its bracketed citation is removed.

- Everything that explains why: policy arguments, the one-year versus three-year limitation mismatch, the Supreme Court's observation about WhatsApp evidence, legislative history, the ILO recommendation, the purpose of registration.

- Worked applications to the facts of the referred case ("Hazırkı iş üzrə ..."), unless the sentence also states the general rule, in which case the case-specific clause is cut.

- Entry into force, publication and finality clauses, always.

## 5.3 Which version of a repeated sentence

The same proposition often appears three times: in the reasoning, in the "nəticələrə gəlir" block and in "QƏRARA ALDI". He takes the conclusions-block wording as the default (short code names such as "Mülki Məcəllənin", verbs in "-məlidir", trailing semicolons left in). He takes the reasoning version instead when it is fuller or carries the presumption and the exception (Banks Law "bütün aktivlərin"; main-field-of-activity rule with its "birdəfəlik və ya qeyri-mütəmadi" exception). He takes the operative wording ("tövsiyə olunsun", "hesab edilsin", "AR Konstitusiyasının") only in a Qərar where the operative part carries something the body does not state as a position: the sole formal outcome is a recommendation (criminal measures), the operative points are the holding itself (director and company; gift form), or the transitional rule is cleaner there (cassation re-filing).

## 5.4 How much

Two to eight bullets. Median length is about 6 to 7 percent of the full text (about 150 to 220 words of quotation from a 2,500 to 3,500 word decision); the range is 2 percent (notary execution record: two transitional rules, 53 words) to 17 percent (criminal measures: seven bullets with sub-lists). Decisions with two or three distinct blocks get up to ten bullets under his own headings "(A) ...", "(B) ...", "(C) ..." written in Azerbaijani and underlined (preliminary contract email). A reasonable target for a new email: one bullet per link in the Court's chain of reasoning that a colleague might cite in a brief, and nothing for links that only explain.

## 5.5 Order

Keep the order of the decision. Of 31 emails, 27 follow the decision exactly; the four reorderings group related points (lease validity moved after the estoppel block; statutory rule placed before the Court's answer; a four-step scheme built for "qanunla qorunan maraq"; conclusions placed before a reasoning paragraph). Reorder only for that reason.

## 5.6 Blind spots to correct

Because he filters by his own topic line, he sometimes leaves out the Court's actual holding or the mechanics a litigator would need. Examples: the jurisdiction answer in the administrative-contract ruling (only the definition was quoted); the no-remand holding in the appellate ruling; two of the three holdings in the sham-transaction decision (notary as deceived third party; repurchase clause must be notarised); the burden-of-proof allocation in the labour-damage decision; the date rule for "should have known" in the limitation decision; the proportionality safeguard in the tax travel-ban decision; the cancellation branch of the legitimate-expectations example, whose deletion made the passage read more favourably than the Court wrote it. The instruction for a new email: after selecting by topic, read the conclusions block and the operative points once more and add any holding, test, transitional rule or safeguard that is missing, even if it answers a different question than the topic line. Never cut a qualifying clause that limits the rule.

# 6. Step 4: edit the passages

He copies from the Court's web page (soft hyphens from the site survive in several emails) and edits in place. He never translates the quotations (one 2023 email was in English; the practice stopped), never paraphrases, never adds his own commentary, and never writes an English summary of the holding beyond the topic line.

## 6.1 Lead-ins and connectives

Delete the opening clause that ties the sentence to the previous paragraph and capitalise the new first word: "Konstitusiya Məhkəməsinin Plenumu hesab edir ki,", "... qeyd edir ki,", "Göründüyü kimi,", "Beləliklə,", "Odur ki,", "Bu baxımdan,", "Bu səbəbdən", "O da nəzərə alınmalıdır ki,", "Nəzərə alınmalıdır ki,", "Qeyd olunanlara əsasən", "Göstərilənlərə əsasən ... belə qənaətə gəlinir ki,". "Vurğulanmalıdır ki" and "Bununla belə" are sometimes kept. In the conclusions block delete the legal-basis preamble: "Konstitusiyanın 13, 29 və 60-cı maddələrinin ... irəli gələrək,", "bu Qərarın təsviri-əsaslandırıcı hissəsində ifadə olunmuş hüquqi mövqelərə əsasən". In operative points delete the article recital that precedes the rule and replace it with "...".

## 6.2 Cuts and the ellipsis

Sentences are dropped from the beginning, middle and end of a paragraph. His marking is inconsistent: in some emails every cut carries "..." (gift form, preliminary contract, estoppel), in others none (indexation, carrier, legitimate expectations). The rule to follow: put "..." wherever words are removed between two quoted spans, inside a sentence or across paragraphs; a cut at the very start or very end of a bullet needs no mark. Keep "..." without spaces inside brackets or quotes.

## 6.3 Merging

Two or three paragraphs, adjacent or a few paragraphs apart, are joined into one bullet, with "..." between them. A first sentence from one paragraph may be joined to the body of a later paragraph. Do not merge sentences that belong to different rules.

## 6.4 Making a bullet stand alone

Replace back-references with the explicit referent so the bullet reads without the surrounding text: "Bundan fərqli olaraq" becomes "Əşya hüququndan fərqli olaraq"; "göstərilən məsələ" becomes "Notariusun apardığı icra qeydindən verilən şikayətlərə dair məsələ"; "Qeyd olunan normaların" becomes the list of articles. Insert in square brackets the statutory text or conditions the reader needs, using the statute's or the Court's own words: "\[ilkin müqavilə üzrə ödənilən məbləğlə bağlı müqavilələr notariat qaydasında təsdiq edilərkən, pul vəsaitinin verilməsi notariusun bankda açdığı depozit hesabı vasitəsilə həyata keçirilir.\]"; "\[ziyan işçi tərəfindən tam maddi məsuliyyət daşıdığı hallarda vurulmuşdursa, ...\]". Nothing else goes in brackets.

## 6.5 Abbreviations

He abbreviates inconsistently: "KM Plenumu" in some emails and "Konstitusiya Məhkəməsinin Plenumu" in full in others, sometimes both in one email; "MPM", "İPM", "MM" (rare), "AR" from mid-2024, "Məcəllənin" after a first full mention, "Azərbaycan Respublikası" sometimes deleted outright. Rule to follow: "KM Plenumu" when the phrase opens a bullet, "MPM" and "İPM" for the procedure codes, "AR" before Konstitusiya and Milli Məclis, and "Mülki Məcəllənin" and "Əmək Məcəlləsinin" kept in full.

## 6.6 Small things

- Bracketed citations of earlier decisions are deleted even mid-sentence; parentheticals carrying secondary content (the 331.1 electronic-form parenthetical, the common-law history of estoppel) are deleted and replaced by "...".

- The Court's typos are usually copied as they are ("nəzərə tutulmuş"); once corrected silently ("təsisşisi"). Correct obvious typos silently; do not add \[sic\].

- Straight quotation marks replace the site's curly ones; soft hyphens should be removed.

- Sub-lists in the decision (criteria, conditions) are reproduced as indented sub-bullets, each item italic, exactly in the Court's order.

- Where the decision has distinct blocks, his own headings "(A) ...", "(B) ...", "(C) ..." are written in Azerbaijani, underlined, in a few words naming the issue ("İlkin müqavilə üzrə ödəniş edilməsinin mümkünlüyü").

- When the operative part is quoted as such he writes his own line "Konstitusiya Məhkəməsinin Plenumu QƏRARA ALDI:" and lists the points as i., ii.

# 7. Step 5: emphasis

Emphasis is the second thing he adds himself and it follows a readable logic.

- Underline: the phrase that carries the legal consequence of each rule, usually the verb phrase at the end ("qiymətləndirilə bilməz", "aid edilmir", "istisna edilməməlidir", "ifadə etmir", "yolverilməzdir", "sui-istifadəsi kimi qiymətləndirilməlidir"); the elements a court must examine; thresholds and periods ("iyirmi faiz", "əlli faiz", "10 günlük müddət"); temporal anchors ("qanuni qüvvəyə minmiş", "icrası anı"); the exception to a rule, when the exception is what helps a corporate client.

- Bold: the one sentence that is the headline rule of the whole decision ("Bu baxımdan əqdin (müqavilənin) forması ilə bağlı tələb yalnız qanunda imperativ qaydada ..."); the name of a concept in a definition ("tələb hüquqlarının güzəşti münasibəti", "əsas meyar", "vasitəçilik"); the title of a statute applied by analogy.

- Italic: in 2023 to early 2025 whole bullets were italic to mark them as quotations; later only the key sentence inside a bullet, or sub-list items.

- Bold and underline together: at most one or two phrases per email, reserved for the sentence a colleague would cite first.

- Not every bullet is emphasised; the conclusions block and transitional rules usually carry none. One to three underlined phrases per bullet, at most one bold phrase per bullet.

# 8. Step 6: assemble the email

The frame never changes. Subject "RE: new decision" (the first email in the thread was "new decision"). The text is "New decision of the Constitutional Court was adopted" also for a Qərardad. The link goes to constcourt.gov.az/az/decision/\<id\>; if the site has not posted the text, to e-qanun.az.

> Dear all,
>
> New decision of the Constitutional Court was adopted - https://constcourt.gov.az/az/decision/\<id\>
>
> ***Topic -- \<question or concept, in English\>***
>
> I am adding the Court's important positions below:
>
> \<bullets, Azerbaijani, verbatim, with underline and bold\>
>
> Regards,
>
> Elgun

From January 2024 to May 2025 the intro read "I am adding the Court's important positions below (in order to clearly and directly show the position of the Court, excerpts are added in Azerbaijani):". From May 2025 the short form returned. Use the short form.

# 9. Step 7: self-check before sending

1.  Every bullet can be found in the decision by searching a six-word string; the only non-Court words are inside square brackets and come from the statute.

2.  The email contains the sentence that answers the topic question.

3.  Every transitional rule, temporal-application rule and re-filing right in the decision is in the email.

4.  No request, facts, constitutional recital, earlier decision, ECtHR case, foreign law, Supreme Court opinion, or entry-into-force clause.

5.  Length between 3 and 14 percent of the full text; two to eight bullets (up to ten with headings).

6.  Order follows the decision unless points were grouped on purpose.

7.  No qualifying clause that limits a rule has been cut; "..." marks every internal cut.

8.  Underline sits on the consequence words; one headline sentence in bold.

9.  The topic line states the question the Court decided, not a thesis it rejected.

10. No commentary, no translation of quotations, no evaluation, no closing summary.

# Appendix A. The 32 emails mapped to the decisions

Current site IDs (the Court re-numbered its pages; his old links 1364 to 1540 and 1623 no longer resolve). Ratio = words quoted divided by words of the full decision. Source: R = the Court's reasoning, C = the "nəticələrə gəlir" block, O = "QƏRARA ALDI", S = statute restated, F = facts.

| **\#** | **Email**  | **Decision** | **ID**        | **Type**          | **Subject**                                                                 | **Bullets** | **Ratio** | **Source** |
|--------|------------|--------------|---------------|-------------------|-----------------------------------------------------------------------------|-------------|-----------|------------|
| E01    | 07.06.2023 | 26.04.2023   | 1596          | Qərar (complaint) | Estoppel; confirmation of a voidable transaction; lease validity            | 5           | 5%        | R          |
| E02    | 20.06.2023 | 16.06.2023   | 1583          | Qərar             | Land Code 73, 75 v Civil Code 719 (lease termination collision); in English | 3           | 6%        | R          |
| E03    | 25.07.2023 | 17.07.2023   | 1591          | Qərar             | Civil contracts, abstract debt acknowledgement in labour relations          | 4           | 6.5%      | R, C       |
| E04    | 27.07.2023 | 10.07.2023   | 1590          | Qərar             | Bank in liquidation; third-party mortgage; civil not bankruptcy proceedings | 4           | 7%        | R, C       |
| E05    | 28.07.2023 | 20.07.2023   | 1589          | Qərar             | Deductions from salary without acceptance; 50% cap                          | 8           | 13%       | R, C       |
| E06    | 30.10.2023 | 20.10.2023   | 1578          | Qərar             | Employment contract where work is in employer's main field                  | 2           | 5%        | R, C       |
| E07    | 26.12.2023 | 18.12.2023   | 1575          | Qərar             | Success fee in legal-assistance contracts                                   | 6           | 5%        | R, C+R, S  |
| E08    | 15.01.2024 | 28.12.2023   | 1571          | Qərar (complaint) | Written form of gift as evidentiary condition (spouses)                     | 5           | 6%        | R, O       |
| E09    | 08.02.2024 | 31.01.2024   | 1572          | Qərar             | Fixed-term contract by mutual consent, LC 47(f)                             | 4           | 7%        | R, S, C    |
| E10    | 27.02.2024 | 22.02.2024   | 1570          | Qərar             | Branches as employer; not parties in court                                  | 4           | 6.5%      | R, C       |
| E11    | 05.03.2024 | 27.02.2024   | 1565          | Qərar (complaint) | Re-filing a returned cassation appeal, CPC 408.5                            | 4           | 6%        | R, O       |
| E12    | 26.04.2024 | 15.04.2024   | 1567          | Qərar             | Tax on voluntary severance, LC 175(4), TC 102.1.4                           | 5           | 7%        | R, S, O    |
| E13    | 02.05.2024 | 26.04.2024   | 1560          | Qərar             | Refusal of gift; preclusive period                                          | 4           | 7%        | R          |
| E14    | 06.05.2024 | 23.04.2024   | 1561          | Qərar             | Grounds for state registration are not exhaustive                           | 3           | 8%        | R, C       |
| E15    | 31.07.2024 | 28.06.2024   | 1555          | Qərar             | Criminal measures against legal entities, CrC 99-5                          | 7           | 17%       | R, O       |
| E16    | 03.10.2024 | 30.09.2024   | 1554          | Qərardad          | Intermediary services in foreign-currency transfers                         | 2           | 5%        | R          |
| E17    | 30.01.2025 | 10.12.2024   | 1536          | Qərardad          | Equality and legitimate expectations in administrative procedure            | 5           | 9%        | F, R, C    |
| E18    | 06.03.2025 | 19.02.2025   | 1538          | Qərar             | Director and company: civil or labour                                       | 5+2         | 10%       | R, O       |
| E19    | 06.05.2025 | 18.04.2025   | 1525          | Qərardad          | Administrative v civil contract                                             | 3           | 8%        | R          |
| E20    | 07.05.2025 | 15.04.2025   | 1532          | Qərar             | Inflation as damage, CC 21.2                                                | 6           | 14%       | R          |
| E21    | 14.05.2025 | \-           | Supreme Court | Uniformity ruling | Letter of an administrative body as an administrative act                   | 3           | \-        | \-         |
| E22    | 27.05.2025 | 16.05.2025   | 1527          | Qərar             | Challenging a notary's execution record; 10-day period                      | 2           | 2%        | C          |
| E23    | 10.06.2025 | 23.05.2025   | 1528          | Qərardad          | "Legally protected interest", CPC 4.1                                       | 4           | 7%        | S, R       |
| E24    | 17.06.2025 | 11.06.2025   | 1529          | Qərardad          | Form of lease of immovable property                                         | 3           | 6%        | R          |
| E25    | 25.06.2025 | 17.06.2025   | 1530          | Qərar             | Indexation on non-enforcement, CPC 232                                      | 5           | 7%        | R, C       |
| E26    | 04.07.2025 | 12.06.2025   | 1469          | Qərardad          | Court must examine the right before rejecting as time-barred                | 2           | 4%        | R          |
| E27    | 08.07.2025 | 19.06.2025   | 1521          | Qərar             | Start of limitation; death of debtor; abuse by heirs                        | 3           | 3.5%      | C, R       |
| E28    | 16.07.2025 | 20.06.2025   | 1520          | Qərar             | Sham transaction; regime of the concealed transaction                       | 3           | 5%        | R          |
| E29    | 28.11.2025 | 24.11.2025   | 1514          | Qərar             | "Carrier"; pre-trip inspections only for commercial carriage                | 5           | 8.5%      | R, C       |
| E30    | 13.04.2026 | 31.03.2026   | 1506          | Qərar             | Travel ban on head of foreign branch for tax debt                           | 3           | 5%        | R, C       |
| E31    | 21.05.2026 | 12.05.2026   | 1531          | Qərar             | Preliminary contract; unfinished buildings; land allotment                  | 10          | 13%       | R          |
| E32    | 18.06.2026 | 16.06.2026   | 1541          | Qərar             | Written form of loan over 3,000 AZN: evidentiary                            | 5+3         | 10%       | R, C       |
| Test   | (withheld) | 25.09.2026   | 1630          | Qərardad          | Good faith and reliance; movables in official registers                     | \-          | \-        | \-         |

# Appendix B. What he skipped, June 2023 to October 2026

Of the 61 Plenum acts not circulated: criminal law and criminal procedure 38; administrative offences without a business angle 6; elections and Milli Məclis 3; family and succession 4; education, pensions, civil service, migration, military, prosecution, courts 8; individual complaints with no general rule 2.

Business-relevant acts that were skipped (read in full): 1585 of 26.07.2023 (property tax on collateral taken over by a bank after a failed auction; AccessBank v State Tax Service); 1533 of 03.04.2025 (limitation for compulsory property-insurance claims of a business; insurer may not wait for the criminal case); 1509 of 18.02.2026 (employers must compensate unused additional leave on termination until Parliament amends LC 144; applies to pending cases); 1543 of 23.06.2026 (a legal entity may not operate from a residential flat unless converted to non-residential use); 1546 of 25.06.2026 (accounting and advisory firms are AML obliged entities only when they participate in listed transactions); 1629 of 13.10.2026 (site visits by the water authority are "inspections" and are void if the business-inspection law is not followed). Skipped on subject matter, defensibly: 1574 and 1558 (inheritance), 1577 (servicemen and labour safety).

# Appendix C. Worked example: the loan decision of 16 June 2026 (ID 1541)

The decision has 51 paragraphs after "MÜƏYYƏN ETDİ": 7 of request, then R1 to R38 of reasoning, 3 conclusions, 6 operative points. R1 to R5 are constitutional recitals; R6 to R9 principles; R10 to R12 and R15 to R17 statutory text; R13 to R14 purpose and a 2023 precedent; R18 to R20 the rules; R21 to R28 the why (restitution, one-year versus three-year limitation, evasion); R29 to R30 the Supreme Court's opinion; R31 to R34 Türkiyə and Qazaxıstan; R35 to R37 electronic form; R38 the practical rule on evidence.

He took R18, R19, R20 (three consecutive rule paragraphs, with "Odur ki" removed, R19 bold and underlined as the headline), R38 (the evidence list, with the 331.1 parenthetical silently cut), and all three conclusions with their legal-basis preambles removed and the lead-in "Qeyd olunanlara əsasən Konstitusiya Məhkəməsinin Plenumu aşağıdakı nəticələrə gəlir:" kept. Nothing from R1 to R17, R21 to R37, or the operative part. Ratio 10 percent. The one thing the method would add: the "..." where the parenthetical was cut.

# Appendix D. Signal phrases

| **Phrase in the decision**                                                        | **What it marks**              | **Action**                             |
|-----------------------------------------------------------------------------------|--------------------------------|----------------------------------------|
| Müraciətdə qeyd edilir ki / Müraciətedən hesab edir ki                            | request summary                | skip                                   |
| Konstitusiyanın ... maddəsinə əsasən                                              | constitutional recital         | skip                                   |
| (... tarixli Qərar) / Konstitusiya Məhkəməsi Plenumunun ... hüquqi mövqeyinə görə | earlier decision               | skip; delete citation if sentence kept |
| Avropa Məhkəməsi ... işi üzrə                                                     | ECtHR                          | skip                                   |
| ... Məcəlləsinin X maddəsinə görə / əsasən                                        | statute restated               | skip unless the statute is the rule    |
| Konstitusiya Məhkəməsinin Plenumu hesab edir ki / qeyd edir ki / vurğulayır       | Court's own position           | candidate; delete the lead-in          |
| Göründüyü kimi / Beləliklə / Odur ki / Bu baxımdan                                | conclusion of a reasoning step | candidate; delete the connective       |
| yanlış olaraq / yolverilməzdir / mümkün deyil                                     | reversal or prohibition        | take; underline                        |
| məsələ qanunvericilik qaydasında həll edilənədək                                  | transitional rule              | always take                            |
| bu Qərar qüvvəyə mindikdən sonra / hazırda məhkəmələrin icraatında olan           | temporal application           | always take                            |
| Milli Məclisinə tövsiyə olunsun / olunmalıdır                                     | recommendation                 | take if it signals change              |
| aşağıdakı nəticələrə gəlir:                                                       | conclusions block              | default source for holdings            |
| QƏRARA ALDI:                                                                      | operative part                 | only in the cases in 5.3               |
| Qərar dərc edildiyi gündən qüvvəyə minir                                          | formalities                    | skip                                   |
