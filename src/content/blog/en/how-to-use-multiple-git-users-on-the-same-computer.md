---
title: How to Use Multiple Git Users on the Same Computer
date: "2025-02-19"
extract: "Managing multiple Git accounts on the same computer is a common need for developers working on both personal and professional projects. Here's a comprehensive guide on how to configure and manage multiple Git accounts effectively."
tags:
  - "git"
coverImage: "/img/blog/how-to-use-multiple-git-users-on-the-same-computer/cm8zzc3wp2jnx07k1je4q4tlc.jpg"
coverAuthorName: Flow
coverAuthorLink: "https://flowthemovie.com/"
coverDescription: a movie by Gints Zilbalodis (2024)
---

## Prerequisites
- Git installed
- GitHub access (or other Git service)
- Terminal with zsh (optional but recommended)

## 1. Create SSH Keys

First, create separate SSH keys for each account:

```bash
# Key for personal account
ssh-keygen -t rsa -b 4096 -C "personal.email@gmail.com"
# Save as ~/.ssh/id_rsa_personal

# Key for work account
ssh-keygen -t rsa -b 4096 -C "work.email@company.com"
# Save as ~/.ssh/id_rsa_work
```

## 2. Configure SSH Config
Create or modify the ~/.ssh/config file:

```bash
# Personal Account
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_personal
    UseKeychain yes
    AddKeysToAgent yes

# Work Account
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_work
    UseKeychain yes
    AddKeysToAgent yes
```

## 3. Configure Git Config
Create two separate Git configuration files:
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
Modify the main ~/.gitconfig file:

``` bash
[includeIf "gitdir:~/personal/"]
    path = ~/.gitconfig-personal

[includeIf "gitdir:~/www/"]
    path = ~/.gitconfig-work
```

## 4. Organize Projects
```bash
~/personal/    # Personal projects
~/www/         # Work projects
```

## 5. Copy the personal and work public key:
```bash
cat ~/.ssh/id_rsa_personal.pub | pbcopy
```
Add to Personal GitHub Account:

- Log into your personal GitHub account
- Go to Settings → SSH and GPG keys → New SSH key
- Give it a descriptive title (e.g., "Personal MacBook")
- Paste the copied public key
- Click "Add SSH key"

Do the same for the work key

```bash
cat ~/.ssh/id_rsa_work.pub | pbcopy
```
etc...

## 6. Test your connection

```bash
# Test personal connection
ssh -T git@github.com-personal

# Test work connection
ssh -T git@github.com-work
```

## Conclusion

This setup creates an automated Git identity switching based on your project's location:

### When working in `~/personal/*` directories:
- Git automatically uses your personal email and username
- Commits will be associated with your personal GitHub account
- SSH authentication uses your personal key

### When working in `~/www/*` directories:
- Git automatically uses your work email and username
- Commits will be associated with your work GitHub account
- SSH authentication uses your work key

This directory-based configuration eliminates the need to manually switch between Git accounts and helps prevent accidentally committing with the wrong identity. You can verify your current Git identity at any time using the `git config user.name` or `git config user.email` command .

Remember: The key to this working correctly is maintaining a consistent project organization:
- Always keep personal projects under `~/personal/`
- Always keep work projects under `~/www/`

