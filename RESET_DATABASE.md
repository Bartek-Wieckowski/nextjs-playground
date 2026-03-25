## 🔄 RESET BAZY DANYCH

Musisz zresetować bazę, żeby zaaplikować nową migrację.

**W swoim terminalu uruchom:**

```bash
# Zatrzymaj Supabase
supabase stop

# Uruchom ponownie (automatycznie zaaplikuje nowe migracje)
supabase start
```

**Lub jeśli Supabase już działa:**

```bash
supabase db reset
```

To usunie wszystkie dane i zaaplikuje nowy schemat!

Po resecie kontynuuj używanie aplikacji normalnie.
