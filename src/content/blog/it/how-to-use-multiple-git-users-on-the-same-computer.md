---
title: Come usare più utenti Git sullo stesso computer
date: "2025-02-19"
extract: "Gestire più account Git sullo stesso computer è un'esigenza comune per gli sviluppatori che lavorano sia su progetti personali che professionali. Ecco una guida completa su come configurare e gestire più account Git in modo efficace."
tags:
  - "git"
coverImage: "/img/blog/how-to-use-multiple-git-users-on-the-same-computer/cm8zzc3wp2jnx07k1je4q4tlc.jpg"
coverAuthorName: Flow
coverAuthorLink: "https://flowthemovie.com/"
coverDescription: a movie by Gints Zilbalodis (2024)
---

## Prerequisiti
- Git installato
- Accesso a GitHub (o altro servizio Git)
- Terminale con zsh (opzionale ma consigliato)

## 1. Creare le chiavi SSH

Per prima cosa, crea chiavi SSH separate per ogni account:

```bash
# Chiave per l'account personale
ssh-keygen -t rsa -b 4096 -C "personal.email@gmail.com"
# Salva come ~/.ssh/id_rsa_personal

# Chiave per l'account di lavoro
ssh-keygen -t rsa -b 4096 -C "work.email@company.com"
# Salva come ~/.ssh/id_rsa_work
```

## 2. Configurare SSH Config
Crea o modifica il file ~/.ssh/config:

```bash
# Account Personale
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_personal
    UseKeychain yes
    AddKeysToAgent yes

# Account di Lavoro
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_work
    UseKeychain yes
    AddKeysToAgent yes
```

## 3. Configurare Git Config
Crea due file di configurazione Git separati:
```bash
# ~/.gitconfig-personal
[user]
    name = PersonalName
    email = personal.email@gmail.com

# ~/.gitconfig-work
[user]
    name = WorkName
    email = work.email@company.com
```
Modifica il file principale ~/.gitconfig:

``` bash
[includeIf "gitdir:~/personal/"]
    path = ~/.gitconfig-personal

[includeIf "gitdir:~/www/"]
    path = ~/.gitconfig-work
```

## 4. Organizzare i progetti
```bash
~/personal/    # Progetti personali
~/www/         # Progetti di lavoro
```

## 5. Copiare la chiave pubblica personale e di lavoro:
```bash
cat ~/.ssh/id_rsa_personal.pub | pbcopy
```
Aggiungi all'account GitHub personale:

- Accedi al tuo account GitHub personale
- Vai su Settings → SSH and GPG keys → New SSH key
- Dai un titolo descrittivo (es. "Personal MacBook")
- Incolla la chiave pubblica copiata
- Clicca su "Add SSH key"

Fai lo stesso per la chiave di lavoro

```bash
cat ~/.ssh/id_rsa_work.pub | pbcopy
```
ecc...

## 6. Testare la connessione

```bash
# Testa la connessione personale
ssh -T git@github.com-personal

# Testa la connessione di lavoro
ssh -T git@github.com-work
```

## Conclusione

Questa configurazione crea un cambio automatico dell'identità Git basato sulla posizione del progetto:

### Quando lavori nelle directory `~/personal/*`:
- Git usa automaticamente la tua email e username personali
- I commit saranno associati al tuo account GitHub personale
- L'autenticazione SSH usa la tua chiave personale

### Quando lavori nelle directory `~/www/*`:
- Git usa automaticamente la tua email e username di lavoro
- I commit saranno associati al tuo account GitHub di lavoro
- L'autenticazione SSH usa la tua chiave di lavoro

Questa configurazione basata sulle directory elimina la necessità di cambiare manualmente tra account Git e aiuta a prevenire commit accidentali con l'identità sbagliata. Puoi verificare la tua identità Git corrente in qualsiasi momento usando il comando `git config user.name` o `git config user.email`.

Ricorda: la chiave perché tutto funzioni correttamente è mantenere un'organizzazione coerente dei progetti:
- Tieni sempre i progetti personali sotto `~/personal/`
- Tieni sempre i progetti di lavoro sotto `~/www/`