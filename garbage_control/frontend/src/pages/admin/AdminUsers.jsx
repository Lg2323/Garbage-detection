export default function AdminUsers() {
  return (
    <div className="card p-3">
      <h4 className="mb-1">Пользователи</h4>
      <div className="text-muted mb-3">
        Здесь будет создание исполнителей/координаторов и список пользователей.
      </div>

      <div className="alert alert-warning mb-0">
        Сейчас на бэке у тебя нет admin-endpoints для пользователей (кроме workers-list).
        Хочешь — сделаем: <b>/api/admin/users/</b> (list/create/update role).
      </div>
    </div>
  );
}
