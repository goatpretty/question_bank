import express from 'express';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { WrongQuestion } from '../../../shared/types.js';

const router = express.Router();

const wrongQuestions: WrongQuestion[] = [];

router.get('/wrongbook', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { isMastered, page = 1, limit = 10 } = req.query;

    let userWrongQuestions = wrongQuestions.filter(wq => wq.userId === userId);
    
    if (isMastered !== undefined) {
      const mastered = isMastered === 'true';
      userWrongQuestions = userWrongQuestions.filter(wq => wq.isMastered === mastered);
    }

    userWrongQuestions.sort((a, b) => b.lastWrongAt.getTime() - a.lastWrongAt.getTime());

    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    
    const paginatedWrongQuestions = userWrongQuestions.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        wrongQuestions: paginatedWrongQuestions,
        total: userWrongQuestions.length,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Get wrongbook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch wrong questions.'
    });
  }
});

router.post('/wrongbook/:questionId', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { questionId } = req.params;

    const existingWrongQuestion = wrongQuestions.find(
      wq => wq.userId === userId && wq.questionId === questionId
    );

    if (existingWrongQuestion) {
      existingWrongQuestion.wrongCount++;
      existingWrongQuestion.lastWrongAt = new Date();
      existingWrongQuestion.isMastered = false;
      existingWrongQuestion.masteredAt = undefined;
    } else {
      const newWrongQuestion: WrongQuestion = {
        id: Date.now().toString(),
        userId,
        questionId,
        wrongCount: 1,
        lastWrongAt: new Date(),
        isMastered: false
      };
      wrongQuestions.push(newWrongQuestion);
    }

    res.json({
      success: true,
      message: 'Wrong question recorded.'
    });
  } catch (error) {
    console.error('Record wrong question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record wrong question.'
    });
  }
});

router.put('/wrongbook/:questionId/master', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { questionId } = req.params;

    const wrongQuestion = wrongQuestions.find(
      wq => wq.userId === userId && wq.questionId === questionId
    );

    if (!wrongQuestion) {
      return res.status(404).json({
        success: false,
        error: 'Wrong question not found.'
      });
    }

    wrongQuestion.isMastered = true;
    wrongQuestion.masteredAt = new Date();

    res.json({
      success: true,
      data: wrongQuestion
    });
  } catch (error) {
    console.error('Master wrong question error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark question as mastered.'
    });
  }
});

router.get('/profile', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const totalWrongQuestions = wrongQuestions.filter(wq => wq.userId === userId).length;
    const masteredWrongQuestions = wrongQuestions.filter(
      wq => wq.userId === userId && wq.isMastered
    ).length;

    res.json({
      success: true,
      data: {
        user: req.user,
        stats: {
          totalWrongQuestions,
          masteredWrongQuestions,
          masteryRate: totalWrongQuestions > 0 ? (masteredWrongQuestions / totalWrongQuestions) * 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile.'
    });
  }
});

export { router as userRouter };