---
title: "Apex Evo 5 With Fettec Electronics"
slug: apex-evo-5-fettec
date: 2026-05-08
updated: 2026-11-01
status: flying
size: 5-inch
iteration: 1
line: "Lost Penny signature Apex"
summary: "I wanted to do a kind of Apex Evo reference build based on the Evo and FETtec electronics."
cover: /images/builds/apex-evo-5-fettec/cover.jpg
coverAlt: "Apex Evo 5 on the workbench with pink and clear props, the camera up front, and a battery strap over the top."
source: https://rotorbuilds.com/build/36919/
cardNote: "It still does not fly right."
---

# Apex Evo 5 With Fettec Electronics

This is the absolute first iteration of the Lost Penny signature Apex build.

## Status / final notes (2026-11-01)

This thing still does not fly right.

It has what is probably micro desyncs on throttle punches, which is likely caused by my fancy motor wire routing (the wires run around and under the ESC).

I am working with Brian White on finding the root cause.

## The build

I wanted to do a kind of Apex Evo reference build based on the Evo and FETtec electronics. This frame and these electronics have a long history of working well together, and I thought I'd see what all the fuss was about.

**Some Factors**

- FETtec ESC is fragile. You need a Spike Absorber and some chonky 50 V caps.
- ImpulseRC went out of business. I have a few new kits, so I made a full 3D model of the frame. I wish I could open-source it. Email your friends at Impulse and ask if they'll let me (I don't know them).
- Some parts are difficult to source.
- Carbon is easy to cut because I have a CNC VMC :P
- Original plan was to use legacy KISS firmware, but research showed the digital OSD was buggy. I would need to use Alpha firmware. See ya, DShot -- hello 2SM+OneWire!

**Criteria**

- Needs to use HDZero Freestyle V2.
- Chonker VTX must remain electrically isolated from the frame and situated on a TPU couch to provide protection.
- I would need to design parts for this. This is good because it slows me down and causes me to build fewer drones. Makes my wife happy.
- Custom mounts should also be used for the power-lead capacitor and FETtec Spike Absorber.
- A custom VTX antenna mount should also be made to match the VTX mount aesthetic and provide protection.
- Wiring should be clean, with custom-crimped harnesses where needed.
- Power leads should run underneath the VTX.

**Aesthetic Requirements**

- Custom parts should reflect the Alien aesthetic from ImpulseRC. They should look like they have been abducted by aliens.
- Curves and ovals should be used to reflect a cheesy 1950s sci-fi vibe.
- Parts should speak to each other, requiring remixing and redesign.
- The FETtec logo on the Spike Absorber should face up. Think if you lift the hood on a Ferrari, it should say Ferrari somewhere.
- Build should accommodate 250 V capacitors, the one that came with the ESC as well as a large genuine Panasonic.
- Capacitors should be situated in TPU mounts and connected with silicone motor-wire trimmings.
- Capacitors should use the B2FPV CappyCaps (Josef is my hero!).
- TPU parts should glow in the dark (because race car).

This all started, like most things do, with trying to figure out where stuff goes and how to make room for everything. It's not that the Evo is a tight frame, but the constraints around the chungus VTX and the required Spike Absorber + 50 V cap were pretty limiting. I knew I wanted the power leads to run under the VTX, so designing a mount for that was first on the agenda. It took me forever to come up with something I liked. Originally I'd planned to use isolated screws to secure the VTX to the TPU mount, but I thought better of it and decided to squish it into place using some downward force from the top plate. This had the advantage of allowing me to expose all sides of this megachonker aluminum cube to airflow for cooling. With the wires run under it, I thought to myself, "Self, is there anything else you can put under that VTX with the space you have?" The answer turned out to be no. I could just fit the receiver under there, but it would have caused an RF nightmare at the back end of the quad, so I decided against it based on the advice from my friend ResonantFPV.

With the VTX mount done and people on FB clamoring for the STL, I could move on to the VTX antenna. This part needed to do two things: provide safe routing of the antenna coax cable and room/guidance for the power leads to keep them from being too squished between it and the top plate. Easy enough with a simple remix of the official Impulse antenna, since they were awesome and provided the STEP file. Just a few cutouts and a lot of fillets.

So now we're getting somewhere. Time to install the power leads and motors. I thought a lot about this since the ESC has those through-holes. If I just soldered the wires to the top, they'd fill with solder and drip down. If I ran the leads through them from the top, they'd come out at entirely the wrong angle. Soldering them from underneath it was. Stupidly, I decided to use high-lead, low-temp solder for this in an effort to reduce thermal stress on the electronics. This was a mistake because the solder, while creating perfectly serviceable joints, solidifies as a super-ugly, decidedly non-shiny mass that looks a little like the Elephant's Foot at Chernobyl. I added flux and reflowed it, but it still solidified matte. The joint, while not aesthetically pleasing, was electrically very good though, so I moved on. Oh, I also included some motor-wire cutoffs in the same joints for the Spike Absorber / cap combo that FETtec requires for 6S.

Next, I spent a few days sticking the capacitor in all the open spaces, seeing where and in which orientation it would fit. It's always nice to situate these vertically if you can, but it wasn't going to happen because it's an enormous 50 V cap that needs a PCB with Zener diodes attached to it. Horizontal it was. I kinda quickly realized that this could provide a kinda cool look though, so I started getting excited about it. The TPU part required probably ten iterations and test fits before I got it right, but in the end it resulted in a pretty cool little plaque that reads FETtec when you take the top plate off. I think it looks clean and it hides those matte gray solder terminals, which is nice.

With that done, I could close Fusion and start wiring everything up. I decided to run the motor wires around and under the ESC. I have always thought this method has a nice, clean look to it, but it is a massive PITA. I also understand it's not the best for noise management and serviceability. These are things that must be sacrificed for cool looks, and I took the credit I received for moving the receiver up front and cashed it in there. I'm mostly happy with the solder joints for the motor wires, although a few could be better. Someone once said, "The perfection is in the imperfection."

Obviously smoke checks and everything went alright, and I set about trimming wires and getting things into their final home. I got real mad when I realized I could not change the aspect ratio on the stupid camera that comes with the Freestyle V2. I probably should have known this, but I didn't and it made me big mad. I'm still mad! Mad enough to give HDZero another $57 for the camera that will support 16:9. That'll teach 'em! FETtec Alpha is kinda weird. Not really weird, but kinda weird. Stuff is just not quite where you expect it to be. It's also worth noting that they use a completely different motor numbering orientation than Betaflight. Just something to know, I guess, but it caused some head-scratching as I was trying to work out the ESC orientation. I got the motors spinning the right direction, applied the 5" preset, and took it for the maiden yesterday. Flew great. I didn't even do a test hover. I just went to a big, soft, grassy field and let her rip on flight #1. Really happy with how it performs right off the preset.

It sucks we can't get real versions of this frame anymore. Hopefully the IP holders will open-source the design so we can keep the arms and plates flowing from companies that are not the Chinese counterfeiters who probably put Impulse out of business to begin with.

I hope you like my build. You can download my STL and STEP files from my GrabCAD account.

## Parts I designed

The parts I designed are linked to a deprecated and completely useless version of the SoloGood Apex Evo frame. They are meant for that frame.

- **VTX couch / mount.** TPU. The Freestyle V2 stays electrically isolated, squished in by the top plate, with the power leads run underneath.
- **VTX antenna mount.** A remix of the official Impulse antenna mount. It routes the coax and leaves room so the power leads are not crushed against the top plate.
- **Spike Absorber / capacitor plaque.** TPU. The FETtec Spike Absorber and the big 50 V cap sit in it, logo up, and it reads FETtec when the top plate comes off.

Glow-in-the-dark TPU, because race car. The B2FPV CappyCaps are Josef's. I did not design those.

STL and STEP files for these mounts are on my GrabCAD account.

## Parts

The airframe only. I left prices off this page. The RotorBuilds post lists what they cost when I wrote it up. The TPU row is filament, not the mounts above.

| Role | Qty | Part |
| --- | --- | --- |
| Frame | 1 | ImpulseRC Apex EVO 5" FPV Frame Kit |
| Flight controller | 1 | Fettec G4-N V1.7 FPV Drone Flight Controller - 20x20mm & 30x30mm |
| ESC | 1 | FETtec 4-IN-1 (6s) 45A Dshot 2400 / 30x30 ESC V1.2 |
| Motors | 4 | ETHiX Mr Steele Silk Motor V6 (2306 1750KV) - 6S |
| Propellers | 1 | Ethix P3 Peanut Butter & Jelly Poly Carbonate Prop - 2CW+2CCW |
| FPV camera | 1 | HDZero Nano 90 V2 FPV Camera By Runcam |
| FPV transmitter | 1 | HDZero Freestyle V2 20x20 25-1000mW HD VTX - U.FL |
| Antenna | 1 | HDZero VTX Antenna |
| Receiver | 1 | RadioMaster RP1 V2 ELRS 2.4GHz Nano Receiver w/ UFL Antenna |
| Batteries | 1 | Tattu R-Line Version 5.0 1200mAh 22.2V 150C 6S1P Lipo Battery - XT60 |
| 3D printed | 4 | High Speed TPU Filament 1.75mm - Fast Flow |

## Bench gear

Radio and bench gear from the same list. None of this is on the quad.

| Role | Part |
| --- | --- |
| Radio | Radiocommande RadioMaster TX15 Max ExpressLRS |
| Goggles | HDZero Goggle 2 |
| Battery charger | HOTA D6 PRO Dual Charger 1-6S AC200W/DC650W 15A w/ Wireless Cellphone Charging - Black |
| Soldering iron | Metcal MX-5210 Soldering and Rework System with 1 Hand-Pieces Black |
| Tools | MIP Hex Driver Wrench Set Gen 2 #9602 \| 1.5mm, 2.0mm, 2.5mm |
| Backpack | Pyrodrone Pyropack Sport FPV Backpack |

## Photos

The rest of the photos, in the same order as the RotorBuilds page.

![Top view of a 5-inch quad on a wooden table, with a white printed antenna mount and clear props.](01.jpg)

![The Apex hovering in the backyard, pink props, battery strapped on top.](02.jpg)

![Side view on the bench: Mr Steele motor bell, camera pod, and the white antenna mount.](03.jpg)

![The quad in the dark with the printed TPU parts glowing.](04.jpg)

![Three-quarter view on the bench, pink and clear props, red and black power leads.](05.jpg)

![Front three-quarter view on the bench, camera pod and white antenna mount.](06.jpg)

![The Apex on a worn bench, FETtec battery strap, pink and clear props.](07.jpg)

![Close-up of the FETtec flight controller above the Spike Absorber in its printed mount.](08.jpg)

![The Spike Absorber in the printed plaque, with the power leads in front.](09.jpg)

![Top plate off: FETtec stack, Spike Absorber, and motor wires run along the arms.](10.jpg)

![A capacitor in a printed TPU mount.](11.jpg)

![The same capacitor mount from the side, leads sticking out.](12.jpg)

![The FETtec Spike Absorber in a clear printed mount, logo facing up.](13.jpg)

![Under the antenna mount, the power leads loop through the printed part.](14.jpg)

![The FETtec 4-in-1 ESC on the carbon, motor wires coming off the pads.](15.jpg)

![ESC solder joints with motor wires bundled and taped along the arms.](16.jpg)

![Motor wires coiled on the arms and taped, with the red Spike Absorber at the edge of the frame.](17.jpg)

## Credit

I wrote this up on [RotorBuilds](https://rotorbuilds.com/build/36919/) on May 8, 2026.
