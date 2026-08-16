export function describeProviderHttpError(
  provider: string,
  status: number,
  details?: string,
): string {
  const hint =
    status === 401 || status === 403
      ? "Проверьте API-ключ в разделе «Хранилище → Секреты»"
      : status === 404
        ? "Проверьте Base API URL — по этому адресу нет нужного метода"
        : status === 429
          ? "Превышен лимит запросов, повторите позже"
          : status >= 500
            ? "Сервис провайдера временно недоступен"
            : "Проверьте настройки подключения";
  const tail = details?.trim() ? ` (${details.trim().slice(0, 200)})` : "";
  return `${provider}: ${hint}. Код ответа ${status}${tail}`;
}
