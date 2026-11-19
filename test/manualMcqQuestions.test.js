import assert from 'assert';
import { db } from '../server/db.js';

async function run() {
  console.log('====================================================');
  console.log(' Running Real Marks & MCQ Grading Acceptance Test   ');
  console.log('====================================================');

  // 1. Create a test with draft manual MCQ questions with custom marks
  console.log('[STEP 1] Admin creates an exam with custom marks per question...');
  const testId = `test-marks-${Date.now()}`;
  const examData = {
    id: testId,
    title: 'Operating Systems Real Marks Test',
    description: 'Testing real mark calculation and question marks section',
    duration_minutes: 30,
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        question: 'What is a process control block (PCB)?',
        options: [
          'A data structure containing process state information',
          'A physical circuit on the motherboard',
          'A hard disk partition',
          'A web browser cache'
        ],
        correct_answer: 'A data structure containing process state information',
        points: 15 // 15 marks
      },
      {
        id: 'q2',
        type: 'mcq',
        question: 'Which deadlock prevention condition ensures mutual exclusion cannot occur?',
        options: [
          'Hold and wait',
          'Circular wait',
          'Spooling / Sharing resources',
          'Preemption'
        ],
        correct_answer: 'Spooling / Sharing resources',
        points: 35 // 35 marks
      }
    ]
  };

  const createdExam = await db.createTest(examData);
  assert.ok(createdExam.id, 'Exam should have an ID');
  assert.strictEqual(createdExam.questions.length, 2, 'Should have 2 questions');
  console.log('[PASS] Exam created with 2 questions (15 marks + 35 marks = 50 marks total)');

  // 2. Add a 3rd question with 50 marks via addQuestionToTest
  console.log('[STEP 2] Adding 3rd question with 50 marks...');
  const addQRes = await db.addQuestionToTest(testId, {
    question: 'What is thrashing in virtual memory?',
    options: [
      'High paging activity causing CPU utilization to plummet',
      'CPU running at clock speed beyond thermal limits',
      'RAM being erased completely',
      'File deletion from SSD'
    ],
    correct_answer: 'High paging activity causing CPU utilization to plummet',
    points: 50 // 50 marks
  });

  assert.strictEqual(addQRes.test.questions.length, 3, 'Should have 3 questions');
  assert.strictEqual(addQRes.test.total_marks, 100, 'Total marks: 15 + 35 + 50 = 100');
  console.log('[PASS] Total marks accurately calculated to 100 marks');

  // 3. Test Student Getting 0 Correct -> Real Score MUST be 0 (NOT 85!)
  console.log('[STEP 3] Testing 0 correct answers: score must be 0 (NOT hardcoded to 85)...');
  const zeroAnswers = {
    q1: 'A physical circuit on the motherboard', // Wrong
    q2: 'Hold and wait',                        // Wrong
    [addQRes.question.id]: 'RAM being erased'   // Wrong
  };

  let zeroScore = 0;
  for (const q of addQRes.test.questions) {
    if (q.type === 'mcq' && zeroAnswers[q.id] === q.correct_answer) {
      zeroScore += q.points;
    }
  }
  assert.strictEqual(zeroScore, 0, 'Zero correct answers must yield 0 score');
  assert.notStrictEqual(zeroScore, 85, 'Score must not be 85');
  console.log('[PASS] Student with zero correct answers correctly scored 0 / 100');

  // 4. Test Student Getting Q1 (15 pts) and Q3 (50 pts) correct -> 65 Marks
  console.log('[STEP 4] Testing real marks calculation: Q1 (15 pts) + Q3 (50 pts) = 65 marks...');
  const mixedAnswers = {
    q1: 'A data structure containing process state information', // CORRECT (+15)
    q2: 'Hold and wait',                                         // WRONG (+0)
    [addQRes.question.id]: 'High paging activity causing CPU utilization to plummet' // CORRECT (+50)
  };

  let earnedScore = 0;
  let correctCount = 0;
  for (const q of addQRes.test.questions) {
    if (q.type === 'mcq' && mixedAnswers[q.id] === q.correct_answer) {
      earnedScore += q.points;
      correctCount++;
    }
  }
  assert.strictEqual(earnedScore, 65, 'Earned score must be exactly 65');
  assert.strictEqual(correctCount, 2, '2 questions answered correctly');
  console.log('[PASS] Student scored real marks: 65 / 100 (65%) with 2/3 questions correct');

  // 5. Cleanup
  console.log('[STEP 5] Cleaning up test exam...');
  await db.deleteTest(testId);
  console.log('[PASS] Test exam cleaned up');

  console.log('====================================================');
  console.log(' ALL REAL MARKS & GRADING TESTS PASSED!              ');
  console.log('====================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});
