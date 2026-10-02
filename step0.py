def answer_question(question):
    # Step 0 mein question ka meaning process nahi hota; answer fixed hai.
    return "Yeh fixed practice answer hai. Hum fundamental rights padhenge."


questions = [
    "Fundamental rights kya hain?",
    "Hindi mein samjhao.",
    "Ek example do.",
]

for question in questions:
    answer = answer_question(question)
    print("Input:", question)
    print("Output:", answer)
    print()
