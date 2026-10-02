# BolPrep

Hindi/Hinglish voice tutor ka beginner project. Abhi sirf Step 0 ka fixed-answer
Python program implement hua hai. AI, voice, website aur benchmarks abhi nahi hain.

## Step 0 chalao

Is folder ke PowerShell terminal mein:

```powershell
python step0.py
```

`python` Python interpreter chalata hai; `step0.py` woh file hai jiska code chalega.
Koi package install ya API key zaroori nahi hai.

## Input se output tak

1. `questions` ek list hai jismein teen question strings hain. String text hoti hai.
2. `for question in questions` har question ko ek-ek karke `question` variable mein rakhta hai.
3. `answer_question(question)` current question function ko input deta hai.
4. `def answer_question(question)` function define karta hai; `question` uska input parameter hai.
5. `return` fixed answer wapas deta hai. Function abhi question ke meaning ka use nahi karta.
6. `answer` variable returned text rakhta hai; `print` input aur output terminal par dikhata hai.
7. Khaali `print()` agle example se pehle blank line deta hai.

Example: input `Hindi mein samjhao.` ho toh output
`Yeh fixed practice answer hai. Hum fundamental rights padhenge.` hoga.
Teenon inputs alag hain, lekin output same hoga. Yeh practice response hai.

Variable value rakhta hai; function ek kaam karta hai; list multiple values rakhti hai.
Dictionary named values rakhti hai, jaise `{"topic": "fundamental rights"}`.
Is chhote program mein dictionary ki zaroorat nahi hai.

## Khud try karo

List mein ek question badlo, file save karo, aur wahi command dobara chalao.
Phir function ka returned text badlo aur dekho ki teenon outputs kaise badalte hain.

Code run hona verify kiya ja sakta hai; tumhari understanding abhi check karni hai:

1. `answer_question("Hindi mein samjhao.")` mein input kya hai aur output kya hai?
2. Teen alag questions par same answer kyun milta hai?
3. `return` aur `print` ka kaam kaise alag hai?

Apne answers aur experiments [learning-log.md](learning-log.md) mein likho.
Agla step text LLM tutor hai; pehle Step 0 ka input/function/output flow explain karo.
