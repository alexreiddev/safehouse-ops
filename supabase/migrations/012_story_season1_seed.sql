-- Anchal Zero, season 1 (Kothamangalam). All drops start inactive and unplaced; place them in HQ after scouting.
insert into story_files(id,case_key,ord,title,place,requires,squad_only,collective_min,collective_of,hold_sec,xp,briefing,archive,theory,archivist_note,hold_prompt,cliffhanger,unlock_line) values
('A1','A',1,'The Box','Perumbavoor Government Rest House','{}',false,0,null,120,150,
$t$There's a box in Perumbavoor that hasn't taken a letter in seventy years.
Go and stand in front of it.
Do not touch it.
You're late, runner.$t$,
$t$Travancore's Anchal post began in 1729 under Marthanda Varma. Its runners carried the mail bag on their heads, with a short staff hung with bells. An old Anchal box still stands at the Perumbavoor Government Rest House.$t$,
$t$Runner [[0-17|A3]] logged out from this box in July 1924, carrying a letter up the old road to Munnar. The bag weighed more than the log says.$t$,
null,'Two minutes facing the box. Imagine the rain starting.',
$t$His name is in the ledger. Someone has scratched it out. Not in 1924. Last month.$t$,
'New files: The Old Road (Case A) and The Sanctuary (Case C).'),

('A2','A',2,'The Old Road','Old route, Kothamangalam toward Thattekad','{A1}',false,0,null,120,150,
$t$He walked this road. So will you.
Look for where the new road forgets the old one.
Find the river. He saw it every day.$t$,
$t$The old royal road ran Aluva, Perumbavoor, Kothamangalam, Thattekad, Kuttampuzha, Pooyamkutty and on to Munnar, wide enough for bullock carts.$t$,
$t$Line one of the letter, recovered: "If you are reading this, the road is already gone."$t$,
$t$You're late. I was here at 06:12. — A.$t$,
'Face the Periyar. He saw this river every day. It was about to change.',
$t$A second note, folded under the first: "He didn't drown, runner."$t$,
'New files: Two Rivers (Case A) and The Barrage (Case B).'),

('A3','A',3,'Two Rivers','Kuttampuzha river confluence ghat (stay back from the water)','{A2}',false,0,null,120,200,
$t$Runners don't swim.
They find a boatman.
Stay back from the water. He did not have that choice.$t$,
$t$Boats on the Kuttampuzhayar near Pooyamkutty worked alongside the old road.$t$,
$t$A boatman's entry, July 1924: two passengers upstream. One is 0-17. The other has no name, only a bell with no clapper.$t$,
$t$Your handler sent you here. Interesting. — A.$t$,
'Watch the two rivers become one. Two of them. Not one.',
$t$Line two of the letter: "Do not trust the one who sends you."$t$,
'Next: The Bar. It opens for everyone once 20 agents have secured Two Rivers.'),

('A4','A',4,'The Bar','Pooyamkutty, road side of the barred bridge','{A3}',true,20,'A3',120,300,
$t$You'll find a bar across the road.
You will not cross it.
Neither did he.
Squad of three. Check out before you go.$t$,
$t$The great flood of July 1924 brought a landslide at Karinthiri that washed the hill away and ruined the road to Munnar. A new road via Neriamangalam was approved in 1931 and opened in 1936. The old road beyond Pooyamkutty is now forest land, closed to traffic.$t$,
$t$1931 is the year the Postmaster's initials first appear in the Zero ledger. Someone made sure the old road stayed forgotten.$t$,
$t$You won't cross. Good. Neither did your handler. — A.$t$,
'Stand at the bar, facing the forest. Phone face-down. Listen. The bell does not ring.',
$t$Line three: "He did not go through. He went up."$t$,
'Finale clue 1 of 4, the direction: up.'),

('B1','B',1,'The Barrage','Bhoothathankettu dam and bridge','{A2}',false,0,null,120,150,
$t$The locals say spirits built a fort here in one night.
Runners called it something else.
They called it the meeting place.$t$,
$t$Bhoothathankettu means "fort of the spirits". Local legend says bhoothams piled the boulders overnight. The modern barrage across the Periyar came much later.$t$,
$t$Zero runners met here before going up the old road. A runner's log from this spot reads: "Work stopped before dawn. Left unfinished, as instructed."$t$,
null,
'Face the old river line. Every telling agrees the builders fled before morning. None of them say what they left behind.',
'As instructed. By whom?',
'New files: The Old Fort (Case B) and The Turning (Case D).'),

('B2','B',2,'The Old Fort','Old Bhoothathankettu trail (ticketed, stay on the path)','{B1}',true,20,'B1',120,300,
$t$Walk to where they tried.
Stay on the path.
The river here is deeper than it looks.
Squad of three. Check out before you start.$t$,
$t$A walking trail through evergreen forest leads from the dam to the old Bhoothathankettu, where legend says the spirits made their failed attempt.$t$,
$t$The Archivist's note was waiting: "Your handler sent his runner up this river in 1924. He knew the rain was coming."$t$,
$t$I've been here longer than you think. — A.$t$,
'Sit. Eyes closed. Listen for a bell that isn''t there.',
'Your handler has gone silent. Twenty-four hours of nothing. Then: "You weren''t supposed to reach this place yet."',
'Finale clue 2 of 4, the time: first light.'),

('C1','C',1,'The Sanctuary','Thattekad bird sanctuary, outside the interpretation centre','{A1}',false,0,null,120,150,
$t$In 1933 a man came to count birds for the Maharaja.
He set up nineteen camps.
Somebody wrote down a twentieth.$t$,
$t$Salim Ali surveyed the birds of Travancore and Cochin in 1933 at the Maharaja's invitation, from 19 base camps, with his wife Tehmina. He picked Thattekad as a collecting centre because the ghat road started here, and the sanctuary was later created on his recommendation.$t$,
$t$A copy of the survey carries a margin note listing a 20th camp, with no coordinates. No published record mentions it.$t$,
null,'Listen at the sanctuary''s edge. Count the calls you can''t name.',
$t$The 20th camp lists one bird: the [[bell-throated runner|C2]]. No such bird exists.$t$,
'Next: The Missing Species.'),

('C2','C',2,'The Missing Species','Public riverbank on the Thattekad reservoir (stay back from the water)','{C1}',false,0,null,120,150,
$t$Things go missing from lists here.
Birds. Camps. Runners.
Stay back from the water.$t$,
$t$In the 1930s, Ali found the Wynaad laughingthrush among the commonest birds at Thattekad. Later surveyors call it a rarely seen resident.$t$,
$t$A Zero code: a "species" means a runner. "Common in 1933, rarely seen now" is how the route recorded its own disappearance.$t$,
$t$They were sent to check the twentieth was still hidden. — A.$t$,
'Watch the water. If you want to stay longer, hire a local bird guide.',
'In 2009 a team retraced all 19 of Ali''s camps. Only nineteen. Why not the twentieth?',
'Next: The Bridge. It opens for everyone once 20 agents have secured The Missing Species.'),

('C3','C',3,'The Bridge','Inchathotty hanging bridge (hold on the far bank)','{C2}',false,20,'C2',120,250,
$t$Cross. Don't stop in the middle.
Some things only make sense from the other side.
Hold on the far bank, not on the bridge.$t$,
$t$A hanging footbridge across the Periyar in Kuttampuzha, a panchayat that is mostly forest and river.$t$,
$t$The margin note's last line places the 20th camp "above the waterfall that has a school beneath it".$t$,
null,'From the far bank, look back at the bridge.',
$t$The handwriting in the margin isn't Ali's. It matches the scratched-out name in the Perumbavoor ledger.$t$,
'Finale clue 3 of 4, the place: a mountain village with a school beneath a waterfall.'),

('D1','D',1,'The Turning','Odakkali junction, Perumbavoor–Kothamangalam road (stop off the road)','{B1}',false,0,null,0,50,
$t$Most people drive past this turning on the way to Munnar.
Runners never did.$t$,
$t$Kallil lies about 4 km off Odakkali, between Perumbavoor and Kothamangalam.$t$,
$t$Zero runners had a saying: "What is unfinished is waiting."$t$,
null,null,
'The spirits left a fort unfinished. Someone else left a face.',
'Next: The Face.'),

('D2','D',2,'The Face','Kallil, at the foot of the steps (outside temple premises)','{D1}',false,20,'D1',120,250,
$t$Stand at the bottom of the steps. Look up.
Don't climb for the game.
If you go up, go as a visitor, on the temple's terms.$t$,
$t$Kallil is a natural rock cave with carved figures of Mahavira, Parsvanatha and Padmavati, once a Jain shrine and now a Bhagavati temple visited by people of all faiths. The figure of Mahavira on the overhanging rock was never finished. It is a state-protected monument.$t$,
$t$Two unfinished things in one valley. The Zero reading: neither was abandoned. Both were paused, until the letter arrives.$t$,
null,'At the foot of the steps, look up at the overhang. Something here has been waiting longer than the letter.',
$t$The Archivist: "The letter has a name on it. Do you want to know whose?"$t$,
'Finale clue 4 of 4, the instruction: bring nothing, leave nothing, finish it.'),

('F','F',1,'The Delivery','Mamalakandam, first light','{A4,B2,C3,D2}',true,0,null,300,1000,
$t$Direction: up.
Time: first light.
Place: above the waterfall with a school beneath it.
Bring nothing. Leave nothing. Finish it.
Squad of three. Check out. Travel by road.$t$,
$t$Mamalakandam is a mountain village about 32 km from Kothamangalam, with a school beneath a waterfall.$t$,
$t$"If you are reading this, the road is already gone.
Do not trust the one who sends you.
He did not go through. He went up."

And the address, never seen until now:
To the runner who comes after.

{CALLSIGN}$t$,
null,'Wait.',
$t$The Postmaster: "Delivered. Welcome to Anchal Zero."

One minute later, the Archivist: "Now you're in the ledger too."$t$,
'Season 1 complete. The ledger has your name now.')
on conflict (id) do nothing;
