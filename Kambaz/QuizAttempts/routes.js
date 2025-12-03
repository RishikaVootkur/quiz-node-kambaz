import * as dao from "./dao.js";
import * as quizDao from "../Quizzes/dao.js";

export default function QuizAttemptRoutes(app) {
  const startAttempt = async (req, res) => {
    const { quizId } = req.params;
    const currentUser = req.session["currentUser"];
    
    if (!currentUser) {
      res.sendStatus(401);
      return;
    }

    const quiz = await quizDao.findQuizById(quizId);
    const attemptCount = await dao.countAttempts(quizId, currentUser._id);
    
    if (!quiz.multipleAttempts && attemptCount >= 1) {
      res.status(403).json({ message: "No attempts remaining" });
      return;
    }
    
    if (quiz.multipleAttempts && attemptCount >= quiz.howManyAttempts) {
      res.status(403).json({ message: "No attempts remaining" });
      return;
    }

    const attempt = {
      quiz: quizId,
      user: currentUser._id,
      course: quiz.course,
      attemptNumber: attemptCount + 1,
      maxScore: quiz.points
    };

    const newAttempt = await dao.createAttempt(attempt);
    res.json(newAttempt);
  };

  const submitAttempt = async (req, res) => {
    const { attemptId } = req.params;
    const { answers } = req.body;
    
    const attempt = await dao.findAttemptById(attemptId);
    const quiz = await quizDao.findQuizById(attempt.quiz);
    
    let score = 0;
    const gradedAnswers = answers.map(answer => {
      const question = quiz.questions.find(q => q._id === answer.questionId);
      let isCorrect = false;
      let pointsEarned = 0;

      if (question.type === "MULTIPLE_CHOICE") {
        const correctChoice = question.choices.find(c => c.isCorrect);
        isCorrect = answer.answer === correctChoice?.text;
      } else if (question.type === "TRUE_FALSE") {
        isCorrect = answer.answer === question.correctAnswer;
      } else if (question.type === "FILL_BLANK") {
        const answerText = question.caseSensitive 
          ? answer.answer 
          : answer.answer?.toLowerCase();
        isCorrect = question.possibleAnswers.some(possible => {
          const possibleText = question.caseSensitive 
            ? possible 
            : possible.toLowerCase();
          return answerText === possibleText;
        });
      }

      if (isCorrect) {
        pointsEarned = question.points;
        score += pointsEarned;
      }

      return {
        ...answer,
        isCorrect,
        pointsEarned
      };
    });

    await dao.submitAttempt(attemptId, gradedAnswers, score, quiz.points);
    
    const updatedAttempt = await dao.findAttemptById(attemptId);
    res.json(updatedAttempt);
  };

  const getAttempt = async (req, res) => {
    const { attemptId } = req.params;
    const attempt = await dao.findAttemptById(attemptId);
    res.json(attempt);
  };

  const getAttemptsForQuiz = async (req, res) => {
    const { quizId } = req.params;
    const currentUser = req.session["currentUser"];
    
    if (!currentUser) {
      res.sendStatus(401);
      return;
    }

    const attempts = await dao.findAttemptsForQuiz(quizId, currentUser._id);
    res.json(attempts);
  };

  const getLatestAttempt = async (req, res) => {
    const { quizId } = req.params;
    const currentUser = req.session["currentUser"];
    
    if (!currentUser) {
      res.sendStatus(401);
      return;
    }

    const attempt = await dao.getLatestAttempt(quizId, currentUser._id);
    res.json(attempt);
  };

  app.post("/api/quizzes/:quizId/attempts", startAttempt);
  app.put("/api/attempts/:attemptId/submit", submitAttempt);
  app.get("/api/attempts/:attemptId", getAttempt);
  app.get("/api/quizzes/:quizId/attempts/user", getAttemptsForQuiz);
  app.get("/api/quizzes/:quizId/attempts/latest", getLatestAttempt);
}