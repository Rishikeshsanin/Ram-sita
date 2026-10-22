const {test,expect} = require('@playwright/test');

test('three friends complete Classic: join, private cards, ready stage, guesses, winners and rematch', async ({browser}) => {
  const contexts = await Promise.all([0,1,2].map(()=>browser.newContext({viewport:{width:390,height:844}})));
  const pages = await Promise.all(contexts.map(ctx=>ctx.newPage()));
  const names=['Host','Asha','Charan'];
  const host=pages[0];
  try {
    await host.goto('/');
    await host.locator('#playerName').fill(names[0]);
    await host.locator('#maxPlayers').selectOption('3');
    await host.locator('#totalRounds').selectOption('3');
    await host.locator('#guessSeconds').selectOption('30');
    await host.locator('#createForm button[type="submit"]').click();
    await expect(host.locator('.code')).toBeVisible();
    const code=(await host.locator('.code').innerText()).trim();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    for (let i=1;i<3;i++) {
      await pages[i].goto('/?room='+code);
      await pages[i].locator('#joinName').fill(names[i]);
      await pages[i].locator('#joinForm button[type="submit"]').click();
      await expect(pages[i].locator('.code')).toHaveText(code);
      await pages[i].locator('[data-action="ready"]').click();
    }
    await expect(host.locator('[data-action="start"]')).toBeEnabled();
    await host.locator('[data-action="start"]').click();

    for (let round=1;round<=3;round++) {
      const dealtRoles=[];
      for (let i=0;i<3;i++) {
        const p=pages[i];
        await expect(p.getByRole('heading',{name:'Check your secret card'})).toBeVisible();
        // The countdown does not start while players are revealing roles.
        await expect(p.locator('#timer')).toHaveCount(0);
        await p.locator('[data-action="flip"]').click();
        const role=(await p.locator('.role-card .role-title').innerText()).trim();
        dealtRoles.push(role);
      }
      expect(dealtRoles.slice().sort()).toEqual(['Rama','Ravana','Sita'].sort());
      for(let i=0;i<3;i++) await pages[i].locator('[data-action="role-ready"]').click();
      await expect(host.getByRole('heading',{name:'The search for Sita'})).toBeVisible();
      await expect(host.locator('#timer')).toBeVisible();
      const ramaIdx=dealtRoles.indexOf('Rama'), sitaIdx=dealtRoles.indexOf('Sita');
      const rama=pages[ramaIdx];
      await rama.locator('[data-action="select"]').filter({hasText:names[sitaIdx]}).click();
      rama.once('dialog',async d=>d.accept());
      await rama.locator('[data-action="guess"]').click();
      await expect(host.getByRole('heading',{name:'Rama found Sita!'})).toBeVisible();
      await expect(host.locator('.reveal-person')).toHaveCount(3);
      await host.locator('[data-action="next"]').click();
    }
    await expect(host.getByText('Final leaderboard')).toBeVisible();
    await expect(host.locator('[data-action="rematch"]')).toBeVisible();
    await host.locator('[data-action="rematch"]').click();
    await expect(host.locator('[data-action="start"]')).toBeVisible();
    await expect(host.locator('[data-action="start"]')).toBeDisabled();
  } finally {
    await Promise.all(contexts.map(ctx=>ctx.close()));
  }
});

test('homepage and setup fit phone and tablet widths',async ({page}) => {
  for(const width of [320,390,768,1200]) {
    await page.setViewportSize({width,height:820});
    await page.goto('/');
    await expect(page.getByRole('heading',{name:/One secret/})).toBeVisible();
    await expect(page.locator('#createForm')).toBeVisible();
    const docWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(width+2);
  }
});
