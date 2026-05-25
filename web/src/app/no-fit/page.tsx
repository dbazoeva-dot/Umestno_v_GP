"use client";
import { useState } from "react";
import Link from "next/link";

export default function NoFit() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: сохранить email в БД
    setSent(true);
  }

  return (
    <main className="max-w-lg mx-auto p-6 pt-16">
      <h1 className="text-2xl font-bold mb-4">
        К сожалению, подобрать конфигурацию не удалось
      </h1>
      <p className="text-gray-600 mb-8">
        По введённым размерам мы не можем собрать надёжную схему. Вы можете
        уменьшить объём одной из категорий или проверить внутренние размеры ящика.
      </p>

      {!sent ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-8">
          <label className="text-sm font-medium">
            Оставьте email — сообщим, когда сможем помочь с вашим случаем:
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border rounded px-3 py-2 flex-1 text-sm"
            />
            <button
              type="submit"
              className="bg-black text-white px-4 py-2 rounded text-sm font-medium"
            >
              Отправить
            </button>
          </div>
        </form>
      ) : (
        <p className="text-green-700 text-sm mb-8">
          Спасибо! Напишем вам, как только расширим покрытие.
        </p>
      )}

      <Link
        href="/"
        className="inline-block border rounded px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        ← Вернуться и изменить параметры
      </Link>
    </main>
  );
}
