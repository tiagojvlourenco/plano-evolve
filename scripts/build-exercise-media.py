#!/usr/bin/env python3
"""Gera as animações da biblioteca de exercícios (pasta exercises/).

Junta as duas fotografias (posição inicial e final) de cada exercício do Free Exercise DB
(https://github.com/yuhonas/free-exercise-db, domínio público / Unlicense) num WebP animado de 360 px.
Uso: guardar exercises.json do Free Exercise DB ao lado deste ficheiro e correr `python3 scripts/build-exercise-media.py`
(precisa de Pillow e curl). O nome do ficheiro é o nome inglês do exercício em minúsculas com hífens (igual a slug() na app).
"""
# PT name -> (English name, dataset name or None)
M = {
"Supino reto com barra":("Barbell Bench Press","Barbell Bench Press - Medium Grip"),
"Supino reto com halteres":("Dumbbell Bench Press","Dumbbell Bench Press"),
"Supino inclinado com halteres":("Incline Dumbbell Press","Incline Dumbbell Press"),
"Supino inclinado com barra":("Incline Barbell Press","Barbell Incline Bench Press - Medium Grip"),
"Press de peito na máquina":("Machine Chest Press","Machine Bench Press"),
"Press inclinado na máquina Smith":("Smith Machine Incline Press","Smith Machine Incline Bench Press"),
"Crucifixo no cabo (baixo para cima)":("Low Cable Fly","Low Cable Crossover"),
"Crucifixo na máquina (peck deck)":("Pec Deck Fly","Butterfly"),
"Flexões":("Push-Up","Pushups"),
"Flexões com apoio elevado":("Incline Push-Up","Incline Push-Up"),
"Fundos nas paralelas (peito)":("Chest Dips","Dips - Chest Version"),
"Crossover no cabo (alto para baixo)":("Cable Crossover","Cable Crossover"),
"Puxada à frente (pega aberta)":("Wide-Grip Lat Pulldown","Wide-Grip Lat Pulldown"),
"Puxada com pega neutra (em V)":("Neutral-Grip Lat Pulldown","V-Bar Pulldown"),
"Barra fixa":("Pull-Up","Pullups"),
"Remada sentada no cabo":("Seated Cable Row","Seated Cable Rows"),
"Remada com apoio no peito (máquina)":("Chest-Supported Machine Row","Leverage Iso Row"),
"Remada com barra":("Barbell Bent-Over Row","Bent Over Barbell Row"),
"Remada com haltere apoiada no banco":("One-Arm Dumbbell Row","One-Arm Dumbbell Row"),
"Remada em T (T-bar)":("T-Bar Row","T-Bar Row with Handle"),
"Pullover no cabo":("Cable Straight-Arm Pulldown","Straight-Arm Pulldown"),
"Encolhimentos com halteres":("Dumbbell Shrug","Dumbbell Shrug"),
"Puxada unilateral no cabo":("Single-Arm Lat Pulldown","One Arm Lat Pulldown"),
"Press de ombros com halteres sentado":("Seated Dumbbell Shoulder Press","Seated Dumbbell Press"),
"Press de ombros na máquina":("Machine Shoulder Press","Machine Shoulder (Military) Press"),
"Landmine press":("Landmine Press",None),
"Elevação lateral com halteres":("Dumbbell Lateral Raise","Side Lateral Raise"),
"Elevação lateral no cabo":("Cable Lateral Raise","Standing Low-Pulley Deltoid Raise"),
"Elevação frontal com cabo":("Cable Front Raise","Front Cable Raise"),
"Face pull":("Face Pull","Face Pull"),
"Crucifixo inverso na máquina":("Reverse Pec Deck Fly","Reverse Machine Flyes"),
"Rotação externa no cabo":("Cable External Rotation","External Rotation with Cable"),
"Press Arnold":("Arnold Press","Arnold Dumbbell Press"),
"Rosca direta com barra":("Barbell Curl","Barbell Curl"),
"Rosca alternada com halteres":("Alternating Dumbbell Curl","Dumbbell Alternate Bicep Curl"),
"Rosca martelo":("Hammer Curl","Hammer Curls"),
"Rosca inclinada com halteres":("Incline Dumbbell Curl","Incline Dumbbell Curl"),
"Rosca no cabo":("Cable Curl","Standing Biceps Cable Curl"),
"Rosca Scott na máquina":("Machine Preacher Curl","Machine Preacher Curls"),
"Rosca martelo no cabo":("Cable Hammer Curl","Cable Hammer Curls - Rope Attachment"),
"Extensão de tríceps na polia":("Triceps Pushdown","Triceps Pushdown"),
"Extensão acima da cabeça no cabo":("Overhead Cable Triceps Extension","Cable Rope Overhead Triceps Extension"),
"Press francês com barra EZ":("EZ-Bar Skullcrusher","EZ-Bar Skullcrusher"),
"Press fechado":("Close-Grip Bench Press","Close-Grip Barbell Bench Press"),
"Fundos em banco":("Bench Dips","Bench Dips"),
"Fundos nas paralelas (tríceps)":("Triceps Dips","Dips - Triceps Version"),
"Extensão de tríceps unilateral na polia":("Single-Arm Triceps Pushdown","Cable One Arm Tricep Extension"),
"Agachamento livre com barra":("Barbell Back Squat","Barbell Squat"),
"Agachamento frontal":("Barbell Front Squat","Front Barbell Squat"),
"Agachamento goblet":("Goblet Squat","Goblet Squat"),
"Leg press 45°":("Leg Press","Leg Press"),
"Hack squat":("Hack Squat","Hack Squat"),
"Agachamento búlgaro":("Bulgarian Split Squat",None),
"Extensão de pernas":("Leg Extension","Leg Extensions"),
"Passada andante":("Walking Lunge","Bodyweight Walking Lunge"),
"Step-up":("Dumbbell Step-Up","Dumbbell Step Ups"),
"Leg press unilateral":("Single-Leg Press",None),
"Peso morto romeno":("Romanian Deadlift","Romanian Deadlift"),
"Peso morto convencional":("Conventional Deadlift","Barbell Deadlift"),
"Curl femoral deitado":("Lying Leg Curl","Lying Leg Curls"),
"Curl femoral sentado":("Seated Leg Curl","Seated Leg Curl"),
"Hiperextensão a 45°":("45° Back Extension","Hyperextensions (Back Extensions)"),
"Nordic curl":("Nordic Hamstring Curl","Natural Glute Ham Raise"),
"Peso morto unilateral com haltere":("Single-Leg Romanian Deadlift","Kettlebell One-Legged Deadlift"),
"Hip thrust":("Barbell Hip Thrust","Barbell Hip Thrust"),
"Ponte de glúteos":("Glute Bridge","Butt Lift (Bridge)"),
"Abdução na máquina":("Machine Hip Abduction","Thigh Abductor"),
"Abdução no cabo":("Cable Hip Abduction",None),
"Coice no cabo (kickback)":("Cable Glute Kickback","One-Legged Cable Kickback"),
"Agachamento sumo":("Dumbbell Sumo Squat","Plie Dumbbell Squat"),
"Passada reversa":("Dumbbell Reverse Lunge","Dumbbell Rear Lunge"),
"Elevação de gémeos em pé":("Standing Calf Raise","Standing Calf Raises"),
"Elevação de gémeos sentado":("Seated Calf Raise","Seated Calf Raise"),
"Elevação de gémeos no leg press":("Leg Press Calf Raise","Calf Press On The Leg Press Machine"),
"Prancha":("Plank","Plank"),
"Prancha lateral":("Side Plank","Side Bridge"),
"Dead bug":("Dead Bug","Dead Bug"),
"Pallof press":("Pallof Press","Pallof Press"),
"Crunch no cabo":("Cable Crunch","Cable Crunch"),
"Elevação de pernas suspenso":("Hanging Leg Raise","Hanging Leg Raise"),
"Roda abdominal":("Ab Wheel Rollout","Ab Roller"),
"Bird dog":("Bird Dog",None),
"Crunch abdominal no chão":("Crunch","Crunches"),
"Elevação de pernas deitado":("Lying Leg Raise","Flat Bench Lying Leg Raise"),
}

import json, os, re, subprocess, unicodedata
from PIL import Image
ds={e['name']:e for e in json.load(open('exercises.json'))}  # descarregar de https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','exercises'); os.makedirs(OUT,exist_ok=True); os.makedirs('raw',exist_ok=True)
def slug(s):
    s=unicodedata.normalize('NFD',s.lower()); s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'(^-|-$)','',re.sub(r'[^a-z0-9]+','-',s))
base='https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
W=360; total=0; fails=[]
for pt,(en,dn) in M.items():
    if not dn: continue
    imgs=ds[dn]['images'][:2]
    frames=[]
    for p in imgs:
        local='raw/'+p.replace('/','__')
        if not os.path.exists(local):
            r=subprocess.run(['curl','-sS','-m','40','-f','-o',local,base+p],capture_output=True)
            if r.returncode: fails.append((en,p)); break
        im=Image.open(local).convert('RGB'); h=round(im.height*W/im.width); frames.append(im.resize((W,h),Image.LANCZOS))
    if len(frames)<2:
        if len(frames)==1: frames=frames*2
        else: continue
    out=f"{OUT}/{slug(en)}.webp"
    frames[0].save(out,save_all=True,append_images=frames[1:],duration=1000,loop=0,quality=62,method=6)
    total+=os.path.getsize(out)
print("ok", len(os.listdir(OUT)), "total KB", total//1024, "falhas", fails)
