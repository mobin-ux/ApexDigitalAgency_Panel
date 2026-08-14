# Authorising the deploy key (one time)

Deploys use an SSH key rather than a password, so no credential has to be
pasted into a chat, stored in a script, or retyped for every release.

## The one command

Run this **in your own terminal**, on this machine, and enter the server's root
password when it asks. The password goes straight from your keyboard to the
server.

```bash
ssh root@146.19.130.11 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICmg2amh0jEYWzM9PIRGV1yva61IDyA5wM7AmRnVCR6B apex-deploy@Mobin' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo AUTHORIZED"
```

It should print `AUTHORIZED`.

## Checking it worked

```bash
ssh -i ~/.ssh/apex_deploy root@146.19.130.11 "hostname; systemctl is-active apex"
```

This should print the hostname and `active` **without asking for a password**.

## What the key can do

It is a normal root login, same as the password — the point is not reduced
privilege, it is that the secret never travels through a conversation and can
be revoked on its own.

To revoke it later, delete its line from `/root/.ssh/authorized_keys` on the
server:

```bash
ssh root@146.19.130.11 "sed -i '/apex-deploy@Mobin/d' ~/.ssh/authorized_keys && echo REVOKED"
```

## Files

- Private key: `~/.ssh/apex_deploy` — stays on this machine, never leaves it.
- Public key: `~/.ssh/apex_deploy.pub` — the line pasted above.

Once authorised, releases are:

```bash
pnpm demo:build && bash scripts/ship-bundle.sh
```
