TODO MBC Reservation

Priorite haute

Frontend

- Ajouter un parcours "gerer ma reservation" a partir d'un code de reservation.
- Ajouter une action "annuler ma reservation" accessible depuis l'email de confirmation.
- Dans le composant Quick Reservation, ajouter une case a cocher pour envoyer l'email de confirmation uniquement si elle est active.
- Dans l'agenda et dans l'ecran d'assignation des tables, afficher le drapeau de la langue du client quand l'information est disponible.

Backend

- Mettre en place un nettoyage automatique des reservations passees, avec suppression ou archivage apres au moins 2 jours.

Priorite moyenne

Fullstack

- Ajouter un parcours complet "gerer ma reservation" avec recherche via code + email, ou nom de reservation, ou numero de telephone.
- Relier ce parcours a l'action d'annulation depuis l'email de confirmation.

Optionnel

Fullstack

- Autoriser certaines reservations longues, par exemple 2h30 ou 3h, uniquement si la demande est faite suffisamment avant le slot. Ne pas autoriser l'extension apres ce delai.
- Si une reservation n'est pas confirmee dans les 30 a 45 minutes, liberer automatiquement la table et marquer la reservation comme non confirmee ou expiree.

Infra

- Definir comment gerer les reponses clients aux emails envoyes via Resend pour les faire suivre vers l'adresse email de reception souhaitee.

Questions a trancher

- Quelle methode d'identification garder pour "gerer ma reservation" : code seul, code + email, ou plusieurs options de recherche ?
- Pour le cleanup des reservations passees, faut-il supprimer definitivement ou archiver ?

- Pour les reservations non confirmees, quelle source fait foi pour le delai : frontend, backend, ou job planifie ?



