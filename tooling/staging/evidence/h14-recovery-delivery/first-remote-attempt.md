# First remote attempt — not PASS

Temporary open version: ec4e1e62-e717-4b77-bed5-e38c7eabf7a1.
Temporary closed version: f1d7cb4d-32e2-4332-860a-241da704f2e9.
Failure cleanup closed version: 5db59223-6eb4-4277-bd4e-887a13bb87d0.
Failure cleanup accepted restore version: 725e36ba-28ee-47bc-856e-ed43884be98d.

Observed PASS stages: persistent accepted SW intercept; ordinary update to exact-path prepare shell; unchanged Product data; POST gate/purpose boundary; bounded recovery; zero-write duplicate.

The attempt did not complete revocation/restore verification. Its cleanup immediately compared sw.js after deployment and still received temporary hash cad249a44caf1789425f92a24f6aa0129ea9443d15ed06d409798b315afdc33b instead of accepted f4b5489e5372aef9f3503a2cc6e513aa6f4c37b84e26097d3242377a2f3b3ddf. This cleanup assertion masked the earlier exception; do not infer that exception's exact reason or count the attempt as PASS.

Subsequent read-only HTTP confirmed accepted SW and closed unauthenticated APIs. No Owner run was issued. The verifier now retains failure evidence, preserves the automation token locally for revocation checks, and requires two consecutive asset/gate readiness observations after remote deployment before browser operations. This is bounded HTTP propagation verification, not forced browser SW update or a storage workaround.
