// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api';
import { LOGIN_RULES, LoginForm } from './login-form';

afterEach(cleanup);

function renderForm() {
  const onSuccess = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LoginForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

describe('LoginForm (validasi tanpa Zod)', () => {
  it('kosong → pesan wajib diisi, tanpa request', async () => {
    const login = vi.spyOn(authApi, 'login');
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('Email wajib diisi')).toBeTruthy();
    expect(screen.getByText('Password wajib diisi')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('email tidak valid → pesan format', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'budi@kantor' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'rahasia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('Format email tidak valid')).toBeTruthy();
  });

  it('valid → email di-trim sebelum dikirim', async () => {
    const login = vi.spyOn(authApi, 'login').mockRejectedValue(new Error('offline'));
    renderForm();
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: '  budi@absenyok.id ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Rahasia123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'budi@absenyok.id', password: 'Rahasia123' }),
    );
  });

  it('aturan email', () => {
    expect(LOGIN_RULES.email.validate('   ')).toBe('Email wajib diisi');
    expect(LOGIN_RULES.email.validate('a@b')).toBe('Format email tidak valid');
    expect(LOGIN_RULES.email.validate(' a@b.id ')).toBe(true);
  });
});
