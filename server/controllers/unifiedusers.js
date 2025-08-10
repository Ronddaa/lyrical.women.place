import { unifiedusersCollection } from "../db/models/unifiedusers.js"; // Убедитесь, что путь верный
import {
  // createunifieduser, // Эту функцию мы больше не используем напрямую
  upsertunifieduser, // Теперь импортируем новую функцию
  getAllunifiedusers,
  getunifieduserById,
} from "../services/unifiedusers.js"; // Убедитесь, что путь верный

// Мы переименовали createunifieduser в upsertunifieduser в сервисе.
// Теперь этот контроллер должен вызывать upsertunifieduser.
export const createunifieduserController = async (req, res, next) => {
  // Добавлен next для передачи ошибок
  const payload = req.body;

  try {
    // Вся логика "проверки, существует ли запись" теперь внутри upsertunifieduser сервиса.
    // Просто вызываем ее, и она либо найдет, либо создаст пользователя.
    const unifieduser = await upsertunifieduser(payload);

    // В зависимости от того, что вернул upsertunifieduser (создание или обновление),
    // можно вернуть соответствующий статус. Сейчас всегда 201, что нормально для upsert.
    res.status(201).json({
      status: 201,
      message: "Successfully processed unifieduser (created or updated)!",
      data: unifieduser,
    });
  } catch (error) {
    // Используем next для передачи ошибки в централизованный errorHandler
    next(error);
  }
};

export const getAllunifiedusersController = async (req, res, next) => {
  // Добавлен next
  try {
    const unifieduser = await getAllunifiedusers();
    res.status(200).json({
      status: 200,
      message: "Unifiedusers were successfully found!",
      data: unifieduser,
    });
  } catch (error) {
    next(error);
  }
};

export const getunifieduserByIdController = async (req, res, next) => {
  // Добавлен next
  try {
    const unifieduser = await getunifieduserById(req.params.id);
    res.status(200).json({
      status: 200,
      message: "Unifieduser was successfully found!",
      data: unifieduser,
    });
  } catch (error) {
    next(error);
  }
};