# 8-bit Avatar Assets

The product owner will provide several 8-bit avatar images later.

MVP behavior:

- avatars are bundled static assets;
- user chooses one from the available set;
- PocketBase stores a stable `avatarKey`;
- arbitrary user image uploads are out of scope.

When the real assets arrive, the implementation phase should place them in the public/static location chosen by the Nuxt design and preserve stable keys even if filenames are later reorganized.
