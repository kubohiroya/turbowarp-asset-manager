# Animation argument migration

The actor animation blocks now expose `ASSETS` as the argument name for the comma-separated list of registered image asset names.

Projects saved with the earlier `COSTUMES` argument remain supported by the implementation as a compatibility alias. The block opcodes are unchanged:

- `startActorLoop`
- `startActorSequence`

The values passed through either argument are Asset Manager asset names, not direct TurboWarp costume names.
